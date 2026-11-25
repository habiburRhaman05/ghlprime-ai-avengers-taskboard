import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor } from '@/lib/auth';
import { visibleTask } from '@/lib/access';
import { query, transaction } from '@/lib/db';
import { MEDIA_LIMIT, MEDIA_TYPES, matchingMedia } from '@/lib/media';
import { cleanDeletedMedia, mediaFilePath } from '@/lib/media-storage';
import { canManageTaskContent } from '@/lib/rules';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage');

function getSigningSecret(): string {
  const rawSecret = process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET;
  if (!rawSecret || rawSecret.length < 16) throw new Error('STORAGE_SIGNING_SECRET is required.');
  return rawSecret;
}

function sign(value: string): string {
  return createHmac('sha256', getSigningSecret()).update(value).digest('hex');
}

function makeToken(objectKey: string, expirySeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expirySeconds;
  const payload = `${objectKey}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 1) return null;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(payload);
  const actualBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;
  const dot = payload.lastIndexOf('.');
  if (dot < 1) return null;
  const objectKey = payload.slice(0, dot);
  const exp = parseInt(payload.slice(dot + 1), 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return objectKey;
}

async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch {}
}

const payload = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin'), taskId: z.uuid(), filename: z.string().trim().min(1).max(180)
    .refine((value) => !/[\\/-]/.test(value)), mime: z.enum(MEDIA_TYPES),
    bytes: z.number().int().min(1).max(MEDIA_LIMIT) }).strict(),
  z.object({ action: z.literal('finish'), taskId: z.uuid(), id: z.uuid() }).strict(),
]);

export async function POST(request: Request) {
  const origin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return NextResponse.json({ error: 'Request origin rejected.' }, { status: 403 });
  const user = await actor();
  if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!canManageTaskContent(user.role)) return NextResponse.json({ error: 'Only project administrators can add attachments.' }, { status: 403 });
  const input = payload.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'File type, size, or request is invalid.' }, { status: 400 });
  const { taskId } = input.data;
  const task = await visibleTask(user, taskId);
  if (!task) return NextResponse.json({ error: 'Task unavailable.' }, { status: 404 });

  await ensureStorageDir();

  if (input.data.action === 'begin') {
    const { mime, filename, bytes } = input.data;
    const id = randomUUID();
    const key = [task.project_id, taskId, id].join('/');

    const reserved = await transaction(async (db) => {
      const { rows: [activeTask] } = await db.query('SELECT id FROM portal.tasks WHERE id=$1 FOR UPDATE', [taskId]);
      if (!activeTask) return 'unavailable';
      const { rows: [usage] } = await db.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM portal.media
         WHERE task_id=$1 AND (ready OR created_at > now() - interval '2 hours')`, [taskId]);
      if (usage.count >= 10) return 'limit';

      await db.query(
        'INSERT INTO portal.media (id,task_id,uploader,object_key,filename,mime,bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, taskId, user.id, key, filename, mime, bytes]);
      return 'reserved';
    });
    if (reserved === 'unavailable') return NextResponse.json({ error: 'Task unavailable.' }, { status: 404 });
    if (reserved === 'limit') return NextResponse.json({ error: 'This task has reached its 10-file limit, including pending uploads.' }, { status: 409 });

    const uploadToken = makeToken(key, 3600);
    const uploadUrl = `/api/media/upload/${encodeURIComponent(uploadToken)}`;
    return NextResponse.json({ id, path: uploadUrl, token: uploadToken });
  }

  const mediaId = input.data.id;
  const finished = await transaction(async db => {
    const { rows: [media] } = await db.query<{
      object_key: string; mime: string; bytes: number; ready: boolean; created_at: Date;
    }>('SELECT object_key,mime,bytes,ready,created_at FROM portal.media WHERE id=$1 AND task_id=$2 AND uploader=$3 FOR UPDATE',
      [mediaId, taskId, user.id]);
    if (!media) return NextResponse.json({ error: 'Upload record unavailable.' }, { status: 404 });
    if (media.ready) return NextResponse.json({ ok: true });
    if (Date.now() - media.created_at.getTime() >= 2 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Upload expired. Select the file again.' }, { status: 409 });
    }

    let validMedia: boolean;
    try {
      const handle = await fs.open(mediaFilePath(media.object_key), 'r');
      try {
        if ((await handle.stat()).size !== media.bytes) throw new Error('Size mismatch');
        const prefix = Buffer.alloc(16);
        const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
        validMedia = matchingMedia(prefix.subarray(0, bytesRead), media.mime);
      } finally {
        await handle.close();
      }
    } catch {
      return NextResponse.json({ error: 'The file has not reached storage yet.' }, { status: 409 });
    }

    if (!validMedia) {
      await db.query('DELETE FROM portal.media WHERE id=$1', [mediaId]);
      return NextResponse.json({ error: 'File contents do not match the selected type.' }, { status: 422 });
    }
    await db.query('UPDATE portal.media SET ready=true WHERE id=$1', [mediaId]);
    return NextResponse.json({ ok: true });
  });
  if (finished.status === 422) await cleanDeletedMedia();
  return finished;
}

import { NextResponse } from 'next/server';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { MEDIA_LIMIT, MEDIA_TYPES } from '@/lib/media';
import { mediaFilePath } from '@/lib/media-storage';
import { actor } from '@/lib/auth';
import { visibleTask } from '@/lib/access';
import { query, transaction } from '@/lib/db';
import { canManageTaskContent } from '@/lib/rules';

function getSigningSecret(): string {
  const rawSecret = process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET;
  if (!rawSecret || rawSecret.length < 16) throw new Error('STORAGE_SIGNING_SECRET is required.');
  return rawSecret;
}

function sign(value: string): string {
  return createHmac('sha256', getSigningSecret()).update(value).digest('hex');
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

export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const objectKey = verifyToken(token);
  if (!objectKey) return new NextResponse('Invalid or expired upload token.', { status: 403 });
  const user = await actor();
  if (!user || !canManageTaskContent(user.role)) return new NextResponse('Upload unavailable.', { status: 404 });
  const { rows: [reservation] } = await query<{ task_id: string; uploader: string | null; mime: string; bytes: number; ready: boolean }>(
    'SELECT task_id,uploader,mime,bytes,ready FROM portal.media WHERE object_key=$1', [objectKey]);
  if (!reservation || reservation.ready || reservation.uploader !== user.id || !(await visibleTask(user, reservation.task_id))) {
    return new NextResponse('Upload unavailable.', { status: 404 });
  }

  const contentLength = request.headers.get('content-length');
  const contentType = request.headers.get('content-type');
  if (!contentLength || !contentType || !MEDIA_TYPES.includes(contentType as typeof MEDIA_TYPES[number])) {
    return new NextResponse('Invalid content type or missing size.', { status: 400 });
  }
  const bytes = parseInt(contentLength, 10);
  if (!Number.isFinite(bytes) || bytes < 1 || bytes > MEDIA_LIMIT) {
    return new NextResponse('File size out of range.', { status: 400 });
  }
  if (bytes !== reservation.bytes || contentType !== reservation.mime) return new NextResponse('Upload does not match its reservation.', { status: 400 });

  const body = request.body;
  if (!body) return new NextResponse('No body.', { status: 400 });
  let received = 0;
  async function* chunks(source: ReadableStream<Uint8Array>) {
    const reader = source.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        received += value.byteLength;
        if (received > bytes) return;
        yield value;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  const filePath = mediaFilePath(objectKey);
  const pendingPath = filePath + '.' + randomUUID() + '.upload';
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(chunks(body), createWriteStream(pendingPath, { flags: 'wx' }));
    if (received !== bytes) return new NextResponse('Size mismatch.', { status: 400 });

    // A deletion either removes the reservation first or queues the installed file.
    const installed = await transaction(async db => {
      const { rows } = await db.query(
        `SELECT f.id FROM portal.media f JOIN portal.tasks t ON t.id=f.task_id
         WHERE f.object_key=$1 AND f.uploader=$2 AND NOT f.ready AND ($3 <> 'client_admin' OR EXISTS (
           SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$2))
         FOR UPDATE OF f`, [objectKey, user.id, user.role],
      );
      if (!rows.length) return false;
      await rename(pendingPath, filePath);
      return true;
    });
    return installed ? new NextResponse('OK') : new NextResponse('Upload unavailable.', { status: 404 });
  } catch {
    return new NextResponse('Upload failed.', { status: 500 });
  } finally {
    await unlink(pendingPath).catch(() => {});
  }
}

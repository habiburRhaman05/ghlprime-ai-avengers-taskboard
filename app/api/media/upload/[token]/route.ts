import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MEDIA_LIMIT, MEDIA_TYPES } from '@/lib/media';
import { actor } from '@/lib/auth';
import { visibleTask } from '@/lib/access';
import { query } from '@/lib/db';
import { canManageTaskContent } from '@/lib/rules';

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage');

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
  const { rows: [reservation] } = await query<{ task_id: string; uploader: string; mime: string; bytes: number; ready: boolean }>(
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

  const filePath = path.join(STORAGE_DIR, objectKey);
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const stream = fs.createWriteStream(filePath);
    const reader = request.body?.getReader();
    if (!reader) return new NextResponse('No body.', { status: 400 });
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      stream.write(Buffer.from(value));
      received += value.length;
      if (received > MEDIA_LIMIT) {
        stream.destroy();
        await fs.promises.unlink(filePath).catch(() => {});
        return new NextResponse('File too large.', { status: 400 });
      }
    }
    stream.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(undefined));
      stream.on('error', reject);
    });
    if (received !== bytes) {
      await fs.promises.unlink(filePath).catch(() => {});
      return new NextResponse('Size mismatch.', { status: 400 });
    }
  } catch {
    await fs.promises.unlink(filePath).catch(() => {});
    return new NextResponse('Upload failed.', { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}

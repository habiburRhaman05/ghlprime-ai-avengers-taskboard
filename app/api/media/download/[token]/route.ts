import { NextResponse } from 'next/server';
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

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const objectKey = verifyToken(token);
  if (!objectKey) return new NextResponse('Invalid or expired download token.', { status: 403 });

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') ?? 'download';

  const filePath = path.join(STORAGE_DIR, objectKey);
  try {
    const fileHandle = await fs.open(filePath, 'r');
    const stat = await fileHandle.stat();
    const stream = fileHandle.createReadStream();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new NextResponse('File not found.', { status: 404 });
  }
}

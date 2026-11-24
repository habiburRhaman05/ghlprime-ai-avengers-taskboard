import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor } from '@/lib/auth';
import { query } from '@/lib/db';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac } from 'node:crypto';

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await actor();
  if (!user || !z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const { rows: [file] } = await query<{ object_key: string; filename: string }>(
    `SELECT f.object_key,f.filename FROM portal.media f JOIN portal.tasks t ON t.id=f.task_id
      WHERE f.id::text=$1 AND f.ready AND ($3 <> 'client_admin' OR EXISTS (
        SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id::text=$2))`, [id, user.id, user.role]);
  if (!file) return new NextResponse(null, { status: 404 });

  const filePath = path.join(STORAGE_DIR, file.object_key);
  try {
    await fs.access(filePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const token = makeToken(file.object_key, 60);
  const downloadUrl = `/api/media/download/${encodeURIComponent(token)}?filename=${encodeURIComponent(file.filename)}`;
  return NextResponse.redirect(new URL(downloadUrl, request.url), { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}

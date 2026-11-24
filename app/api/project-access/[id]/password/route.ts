import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor } from '@/lib/auth';
import { query } from '@/lib/db';
import { decryptAccessPassword } from '@/lib/access-credentials';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await actor();
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!user || !z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404, headers });
  const { rows: [item] } = await query<{ id: string; project_id: string; legacy_task_id: string | null; encrypted_password: string | null }>(
    `SELECT a.id,a.project_id,a.legacy_task_id,a.encrypted_password FROM portal.project_access_items a
     WHERE a.id=$1 AND ($3 <> 'client_admin' OR EXISTS
       (SELECT 1 FROM portal.memberships m WHERE m.project_id=a.project_id AND m.user_id=$2))`, [id, user.id, user.role]);
  if (!item?.encrypted_password) return new NextResponse(null, { status: 404, headers });
  const context = item.legacy_task_id ?? item.project_id + ':' + item.id;
  try { return NextResponse.json({ password: decryptAccessPassword(item.encrypted_password, context) }, { headers }); }
  catch { return NextResponse.json({ error: 'Credential unavailable.' }, { status: 503, headers }); }
}

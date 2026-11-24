import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor } from '@/lib/auth';
import { query } from '@/lib/db';
import { decryptTaskPassword } from '@/lib/task-credentials';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await actor();
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!user || !z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404, headers });
  const { rows: [item] } = await query<{ task_id: string; encrypted_password: string | null }>(
    `SELECT r.task_id,r.encrypted_password FROM portal.task_resources r JOIN portal.tasks t ON t.id=r.task_id
     WHERE r.id=$1 AND ($3 <> 'client_admin' OR EXISTS
       (SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$2))`, [id, user.id, user.role]);
  if (!item?.encrypted_password) return new NextResponse(null, { status: 404, headers });
  try { return NextResponse.json({ password: decryptTaskPassword(item.encrypted_password, item.task_id) }, { headers }); }
  catch { return NextResponse.json({ error: 'Credential unavailable.' }, { status: 503, headers }); }
}

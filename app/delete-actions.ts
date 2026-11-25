'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormResult } from '@/app/components';
import { requireSuperAdmin } from '@/lib/auth';
import { query, transaction } from '@/lib/db';
import { cleanDeletedMedia } from '@/lib/media-storage';

export async function deleteTask(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Task unavailable.' };

  const { rows: [deleted] } = await query<{ slug: string }>(
    `DELETE FROM portal.tasks t USING portal.projects p WHERE t.id=$1 AND t.project_id=p.id RETURNING p.slug`,
    [id.data],
  );
  if (!deleted) return { error: 'Task unavailable.' };
  await cleanDeletedMedia();
  const projectPath = '/projects/' + deleted.slug;
  revalidatePath(projectPath);
  revalidatePath('/tasks/' + id.data);
  revalidatePath('/dashboard');
  redirect(projectPath + '?deleted=task');
}

export async function deleteProject(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Project unavailable.' };

  const { rows: [deleted] } = await query<{ slug: string }>(
    'DELETE FROM portal.projects WHERE id=$1 RETURNING slug', [id.data],
  );
  if (!deleted) return { error: 'Project unavailable.' };
  await cleanDeletedMedia();
  revalidatePath('/projects/' + deleted.slug);
  revalidatePath('/tasks/[id]', 'page');
  revalidatePath('/tasks/new');
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/dashboard?deleted=project');
}

export async function deleteMember(_: FormResult, form: FormData): Promise<FormResult> {
  const admin = await requireSuperAdmin();
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success || id.data === admin.id) return { error: 'Member unavailable.' };

  const deleted = await transaction(async db => {
    const { rows: [profile] } = await db.query<{ email: string }>(
      "SELECT email FROM portal.users WHERE id=$1 AND role <> 'super_admin'", [id.data],
    );
    if (!profile) return false;

    // Lock the login before the profile, as in the account provisioning actions.
    const { rows: accounts } = await db.query<{ id: string; role: string }>(
      'SELECT id,role FROM public."User" WHERE lower(email)=lower($1) ORDER BY id FOR UPDATE', [profile.email],
    );
    if (accounts.some(account => account.role === 'super_admin')) return false;
    const { rows: [member] } = await db.query<{ id: string }>(
      "SELECT id FROM portal.users WHERE id=$1 AND email=$2 AND role <> 'super_admin' FOR UPDATE", [id.data, profile.email],
    );
    if (!member) return false;

    await db.query('DELETE FROM portal.media WHERE uploader=$1 AND NOT ready', [member.id]);
    await db.query('DELETE FROM portal.users WHERE id=$1', [member.id]);
    await db.query('DELETE FROM public."User" WHERE id=ANY($1::text[])', [accounts.map(account => account.id)]);
    return true;
  });
  if (!deleted) return { error: 'Member unavailable.' };
  await cleanDeletedMedia();
  revalidatePath('/settings');
  revalidatePath('/tasks/[id]', 'page');
  redirect('/settings?deleted=member');
}

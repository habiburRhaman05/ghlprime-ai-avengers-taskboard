'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { visibleProject } from '@/lib/access';
import { encryptAccessPassword } from '@/lib/access-credentials';
import { requireActor } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageTaskContent } from '@/lib/rules';
import { parseProjectAccessForm } from '@/lib/validation';
import type { FormResult } from '@/app/components';

export async function addProjectAccessItems(projectId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Only project administrators can add access items.' };
  form.set('projectId', projectId);
  const input = parseProjectAccessForm(form);
  if (!input.success) {
    const issue = input.error.issues[0];
    return { error: issue.message, field: issue.path.join('.') };
  }
  const project = await visibleProject(user, input.data.projectId);
  if (!project) return { error: 'Project unavailable.' };

  let entries;
  try {
    entries = input.data.accessItems.map(item => {
      const id = randomUUID();
      return {
        id,
        label: item.label,
        url: item.url || null,
        account_email: item.email || null,
        note: item.note || null,
        encrypted_password: item.password ? encryptAccessPassword(item.password, project.id + ':' + id) : null,
      };
    });
  } catch {
    return { error: 'Credential storage is not configured. Contact your administrator.' };
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO portal.project_access_items (id, project_id, created_by, label, url, account_email, note, encrypted_password)
     SELECT item.id, p.id, $2, item.label, item.url, item.account_email, item.note, item.encrypted_password
     FROM portal.projects p CROSS JOIN jsonb_to_recordset($3::jsonb)
       AS item(id uuid, label text, url text, account_email text, note text, encrypted_password text)
     WHERE p.id=$1 AND ($4='super_admin' OR EXISTS (
       SELECT 1 FROM portal.memberships WHERE project_id=p.id AND user_id=$2))
     RETURNING id`,
    [project.id, user.id, JSON.stringify(entries), user.role],
  );
  if (!rows.length) return { error: 'Project unavailable.' };
  revalidatePath('/projects/' + project.slug);
  return { ok: rows.length === 1 ? 'Access item added.' : 'Access items added.' };
}

export async function removeProjectAccessItem(projectId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Only project administrators can remove access items.' };
  const item = z.uuid().safeParse(form.get('itemId'));
  if (!item.success) return { error: 'Access item unavailable.' };
  const project = await visibleProject(user, projectId);
  if (!project) return { error: 'Access item unavailable.' };

  const { rows } = await query<{ id: string }>(
    `DELETE FROM portal.project_access_items a
     WHERE a.id=$1 AND a.project_id=$2 AND ($4='super_admin' OR EXISTS (
       SELECT 1 FROM portal.memberships WHERE project_id=a.project_id AND user_id=$3))
     RETURNING a.id`,
    [item.data, project.id, user.id, user.role],
  );
  if (!rows.length) return { error: 'Access item unavailable.' };
  revalidatePath('/projects/' + project.slug);
  return { ok: 'Access item removed.' };
}

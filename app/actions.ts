'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authenticate, createSession, destroySession, requireActor, requireSuperAdmin, changePassword as changeUserPassword } from '@/lib/auth';
import { requireTask, visibleProject } from '@/lib/access';
import { query, transaction } from '@/lib/db';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { canManageTaskContent, canTransition, validDeadline, workflowFormFields, type Status } from '@/lib/rules';
import { parseNewTaskForm, safeLink, taskUpdate } from '@/lib/validation';

type FormResult = { error?: string; field?: string; ok?: string };
const read = (form: FormData, key: string) => String(form.get(key) ?? '');
function validation(error: z.ZodError): FormResult {
  const issue = error.issues[0];
  return { error: issue.message, field: issue.path.join('.') };
}

export async function login(_: FormResult, form: FormData): Promise<FormResult> {
  const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(256) })
    .safeParse({ email: read(form, 'email').trim().toLowerCase(), password: read(form, 'password') });
  if (!input.success) return { error: 'Enter your account email and password.' };
  const user = await authenticate(input.data.email, input.data.password);
  if (!user) return { error: 'Sign-in failed. Check your email and password.' };
  await createSession(user);
  redirect('/dashboard');
}

export async function changePassword(_: FormResult, form: FormData): Promise<FormResult> {
  const newPassword = read(form, 'password');
  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== read(form, 'confirm')) {
    return { error: 'Use 12–128 characters and enter the same password twice.' };
  }
  const user = await requireActor();
  await changeUserPassword(user.email, newPassword);
  return { ok: 'Password updated.' };
}

export async function signOut() {
  await destroySession();
  redirect('/login');
}

export async function createProjectTask(projectId: string, previous: FormResult, form: FormData): Promise<FormResult> {
  // The project is bound by the server when the form is rendered; never trust
  // a replacement project ID supplied in the browser's form data.
  form.set('projectId', projectId);
  return createTask(previous, form);
}

export async function createTask(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Task creation is limited to project and platform admins.' };
  const result = parseNewTaskForm(form);
  if (!result.success) return validation(result.error);
  const input = result.data;
  const project = await visibleProject(user, input.projectId);
  if (!project) return { error: 'Project unavailable.' };
  const existing = await query<{id: string}>(
    'SELECT id FROM portal.tasks WHERE created_by=$1 AND request_id=$2 AND project_id=$3',
    [user.id, input.requestId, project.id]);
  if (existing.rows[0]) redirect('/tasks/' + existing.rows[0].id);
  const deadlineError = { error: 'Choose a completion deadline at least 24 hours from now.', field: 'dueAt' };
  if (!validDeadline(input.dueAt, Date.now())) return deadlineError;

  const taskId = randomUUID();
  const { rows: [created] } = await query<{ id: string }>(
    `INSERT INTO portal.tasks
        (id, project_id, created_by, request_id, title, instructions, checklist, caption, reference_url, due_at)
      SELECT $1,p.id,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz FROM portal.projects p
      WHERE p.id=$2 AND $10::timestamptz >= statement_timestamp() + interval '24 hours'
        AND ($11 <> 'client_admin' OR EXISTS (
          SELECT 1 FROM portal.memberships WHERE project_id=$2 AND user_id=$3))
      FOR KEY SHARE OF p
      ON CONFLICT (created_by, request_id) DO NOTHING RETURNING id`,
    [taskId, project.id, user.id, input.requestId, input.title, input.instructions, JSON.stringify(input.checklist),
      input.caption || null, input.referenceUrl || null, input.dueAt, user.role],
  );

  if (!created) {
    if (!(await visibleProject(user, project.id))) return { error: 'Project unavailable.' };
    const { rows: [retry] } = await query<{ id: string }>(
      'SELECT id FROM portal.tasks WHERE created_by=$1 AND request_id=$2 AND project_id=$3', [user.id, input.requestId, project.id],
    );
    if (retry) redirect('/tasks/' + retry.id);
    return deadlineError;
  }

  revalidatePath('/dashboard');
  revalidatePath('/projects/' + project.slug);
  redirect('/tasks/' + taskId + '?created=1');
}

export async function postComment(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  const result = z.object({ taskId: z.uuid(), body: z.string().trim().min(1).max(2500),
    kind: z.enum(['update', 'learning']) }).safeParse({
    taskId: read(form, 'taskId'), body: read(form, 'body'), kind: read(form, 'kind'),
  });
  if (!result.success) return validation(result.error);
  const { taskId, body, kind } = result.data;
  await requireTask(user, taskId);
  await query('INSERT INTO portal.comments (task_id,author_id,kind,body) VALUES ($1,$2,$3,$4)',
    [taskId, user.id, kind, body]);
  revalidatePath('/tasks/' + taskId);
  return { ok: 'Posted.' };
}

export async function updateTask(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  const result = taskUpdate.safeParse(workflowFormFields(form));
  if (!result.success) return validation(result.error);
  const { taskId, status, blocker, note } = result.data;
  await requireTask(user, taskId);
  const outcome = await transaction(async (db) => {
  const updated = await db.query<{ status: Status; blocker: string; blocker_note: string }>(
    'SELECT status,blocker,blocker_note FROM portal.tasks WHERE id=$1 FOR UPDATE', [taskId]);
  const old = updated.rows[0];
  if (!old) return { error: 'Task unavailable.' };
  if (!canTransition(user.role, old.status, status)) return { error: 'That status change is unavailable. Refresh the task and try again.' };
  if (old.status === status && old.blocker === blocker && old.blocker_note === note) return { ok: 'Task updated.' };
  await db.query(`UPDATE portal.tasks SET status=$1,blocker=$2,blocker_note=$3,
    updated_at=statement_timestamp() WHERE id=$4`, [status, blocker, note, taskId]);
  await db.query("INSERT INTO portal.events (task_id,actor_id,action,details) VALUES ($1,$2,'workflow_updated',$3)",
    [taskId, user.id, JSON.stringify({ from: old.status, to: status, blocker })]);
  return { ok: 'Task updated.' };
  });
  if (outcome.error) return outcome;
  revalidatePath('/tasks/' + taskId);
  revalidatePath('/dashboard');
  return outcome;
}

export async function createProject(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const name = z.string().trim().min(2).max(100).safeParse(read(form, 'name'));
  if (!name.success) return { error: 'Enter a project name between 2 and 100 characters.' };
  const slug = name.data.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return { error: 'The project name must contain a letter or number.' };
  const { rows } = await query<{ id: string }>('INSERT INTO portal.projects (name,slug) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING RETURNING id',
    [name.data, slug]);
  if (!rows[0]) return { error: 'A project with that slug already exists.' };
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: 'Project created.' };
}

export async function createUser(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const data = z.object({ name: z.string().trim().min(1).max(100), email: z.email().max(254),
    role: z.enum(['client_admin', 'agency_member']), project: z.union([z.uuid(), z.literal('all'), z.literal('')]),
    password: z.string().min(12).max(128) }).safeParse({
    name: read(form, 'name'), email: read(form, 'email').trim().toLowerCase(), role: read(form, 'role'),
    project: read(form, 'project'), password: read(form, 'password'),
  });
  if (!data.success) return { error: 'Enter a valid name and email, role, and a password of at least 12 characters.' };
  const { name, email, role, project, password } = data.data;
  const allProjects = project === '' || project === 'all';
  if (role === 'agency_member' && !allProjects) return { error: 'Agency members have access to all projects. Select All projects.' };
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      if (!allProjects) {
        const found = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM portal.projects WHERE id=${project}::uuid`;
        if (!found.length) throw new Error('PROJECT_UNAVAILABLE');
      }
      await tx.user.create({ data: { name, email, role, password_hash: passwordHash } });
      const profiles = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO portal.users (id,name,role,email,password_hash,all_projects)
        VALUES (gen_random_uuid(),${name},${role}::portal.role,${email},${passwordHash},${role === 'client_admin' && allProjects}) RETURNING id`;
      if (!allProjects) await tx.$executeRaw`INSERT INTO portal.memberships (project_id,user_id) VALUES (${project}::uuid,${profiles[0].id}::uuid)`;
    }, { timeout: 20000 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_UNAVAILABLE') return { error: 'Project unavailable.' };
    return { error: 'Could not create the account. Check that the email is unused and the agency member slot is available.' };
  }
  revalidatePath('/settings');
  return { ok: 'User created. Share the temporary password securely.' };
}

export async function editTaskContent(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Only project administrators can change task content.' };
  const input = z.object({ taskId: z.uuid(), title: z.string().trim().min(3).max(120), instructions: z.string().trim().min(1).max(5000),
    caption: z.string().trim().max(2200), checklist: z.array(z.string().trim().min(1).max(160)).max(12), referenceUrl: safeLink
  }).safeParse({ taskId: read(form, 'taskId'), title: read(form, 'title'), instructions: read(form, 'instructions'),
    caption: read(form, 'caption'), checklist: read(form, 'checklist').split('\n').map(line => line.trim()).filter(Boolean),
    referenceUrl: read(form, 'referenceUrl') });
  if (!input.success) return validation(input.error);
  await requireTask(user, input.data.taskId);
  const { taskId, title, instructions, caption, checklist, referenceUrl } = input.data;
  const updated = await query<{ id: string }>(`UPDATE portal.tasks t SET title=$1,instructions=$2,caption=$3,checklist=$4::jsonb,
    reference_url=$5,updated_at=statement_timestamp()
    WHERE t.id=$6 AND ($8 <> 'client_admin' OR EXISTS (SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$7)) RETURNING t.id`,
    [title, instructions, caption || null, JSON.stringify(checklist), referenceUrl || null, taskId, user.id, user.role]);
  if (!updated.rows.length) return { error: 'Task unavailable.' };
  revalidatePath('/tasks/' + taskId); revalidatePath('/dashboard'); revalidatePath('/projects/[slug]', 'page');
  return { ok: 'Task content updated.' };
}

export async function addTaskMediaLink(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Only project administrators can change task content.' };
  const data = z.object({
    taskId: z.uuid(), label: z.string().trim().min(1).max(100), url: safeLink,
    note: z.string().trim().max(2000),
  }).safeParse({
    taskId: read(form, 'taskId'), label: read(form, 'label'), url: read(form, 'url'), note: read(form, 'note'),
  });
  if (!data.success) return validation(data.error);
  const { taskId, label, url, note } = data.data;
  if (!url) return { error: 'Enter a media URL.', field: 'url' };
  await requireTask(user, taskId);
  const result = await query<{ id: string }>(`INSERT INTO portal.task_resources (task_id,created_by,kind,label,url,note)
    SELECT t.id,$2,'media_link',$3,$4,$5 FROM portal.tasks t WHERE t.id=$1
    AND ($6 <> 'client_admin' OR EXISTS (SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$2)) RETURNING id`,
    [taskId, user.id, label, url, note || null, user.role]);
  if (!result.rows.length) return { error: 'Task unavailable.' };
  revalidatePath('/tasks/' + taskId);
  return { ok: 'Media link added.' };
}

export async function removeTaskMediaLink(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await requireActor();
  if (!canManageTaskContent(user.role)) return { error: 'Only project administrators can change task content.' };
  const data = z.object({ taskId: z.uuid(), resourceId: z.uuid() }).safeParse({ taskId: read(form, 'taskId'), resourceId: read(form, 'resourceId') });
  if (!data.success) return { error: 'Resource unavailable.' };
  await requireTask(user, data.data.taskId);
  const result = await query<{ id: string }>(`DELETE FROM portal.task_resources r USING portal.tasks t WHERE r.id=$1 AND r.task_id=$2 AND t.id=r.task_id AND r.kind='media_link'
    AND ($4 <> 'client_admin' OR EXISTS (SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id=$3)) RETURNING r.id`,
    [data.data.resourceId, data.data.taskId, user.id, user.role]);
  if (!result.rows.length) return { error: 'Resource unavailable.' };
  revalidatePath('/tasks/' + data.data.taskId);
  return { ok: 'Media link removed.' };
}

export async function grantAccess(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const result = z.object({ email: z.email().max(254), name: z.string().trim().min(1).max(100),
    role: z.enum(['client_admin', 'agency_member']), project: z.union([z.uuid(), z.literal('all'), z.literal('')]) })
    .safeParse({ email: read(form, 'email').trim().toLowerCase(), name: read(form, 'name'),
      role: read(form, 'role'), project: read(form, 'project') });
  if (!result.success) return validation(result.error);
  const { email, name, role, project } = result.data;
  const allProjects = project === '' || project === 'all';
  if (role === 'agency_member' && !allProjects) return { error: 'Agency members have access to all projects. Select All projects.' };
  if (!allProjects && !(await query<{count: number}>('SELECT count(*)::integer AS count FROM portal.projects WHERE id=$1', [project])).rows[0].count) {
    return { error: 'Project unavailable.' };
  }

  return await transaction(async (db) => {
    const { rows: [account] } = await db.query<{ role: string; password_hash: string }>(
      'SELECT role,password_hash FROM public."User" WHERE email=$1 FOR KEY SHARE', [email],
    );
    if (!account) return { error: 'Create this login account before granting access.' };
    if (account.role !== role) return { error: 'This account already has a different role.' };
    const { rows: [profile] } = await db.query<{ id: string; role: string }>(
      `INSERT INTO portal.users (id,name,role,email,password_hash) VALUES (gen_random_uuid(),$1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET email=excluded.email RETURNING id,role`,
      [name, role, email, account.password_hash]);
    if (profile.role !== role) return { error: 'This account already has a different role.' };
    if (role === 'client_admin') {
      if (allProjects) {
        await db.query('UPDATE portal.users SET all_projects=true WHERE id=$1', [profile.id]);
        await db.query('INSERT INTO portal.memberships (project_id,user_id) SELECT id,$1 FROM portal.projects ON CONFLICT DO NOTHING', [profile.id]);
      } else {
        await db.query('INSERT INTO portal.memberships VALUES ($1,$2) ON CONFLICT DO NOTHING', [project, profile.id]);
      }
    }
    return { ok: 'Access granted.' };
  });
}

export async function revokeAccess(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([read(form, 'project'), read(form, 'user')]);
  if (!ids.success) return { error: 'Invalid membership.' };
  await query('DELETE FROM portal.memberships WHERE project_id=$1 AND user_id=$2', ids.data);
  revalidatePath('/settings');
  return { ok: 'Project access removed.' };
}

export async function stopAutomaticAccess(_: FormResult, form: FormData): Promise<FormResult> {
  await requireSuperAdmin();
  const userId = z.uuid().safeParse(read(form, 'user'));
  if (!userId.success) return { error: 'Account unavailable.' };
  const result = await query<{ id: string }>(
    `UPDATE portal.users SET all_projects=false WHERE id=$1 AND role='client_admin' AND all_projects RETURNING id`, [userId.data]);
  if (!result.rows.length) return { error: 'Account unavailable.' };
  revalidatePath('/settings');
  return { ok: 'Automatic access to future projects stopped. Existing memberships are unchanged.' };
}

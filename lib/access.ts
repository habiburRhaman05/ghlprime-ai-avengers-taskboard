import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { Actor } from './auth';
import { query } from './db';
import type { Blocker, Status } from './rules';

export type Project = { id: string; name: string; slug: string };
export type Task = {
  id: string; number: string; project_id: string; title: string; instructions: string;
  checklist: string[]; caption: string | null; reference_url: string | null;
  assignee: string;
  status: Status; blocker: Blocker; blocker_note: string; due_at: Date; created_at: Date;
};
export async function projectsFor(user: Actor) {
  const { rows } = await query<Project>(
    `SELECT p.* FROM portal.projects p WHERE $2 <> 'client_admin' OR EXISTS
      (SELECT 1 FROM portal.memberships m WHERE m.project_id=p.id AND m.user_id::text=$1)
      ORDER BY p.name`, [user.id, user.role]);
  return rows;
}
export async function visibleProject(user: Actor, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return (await projectsFor(user)).find((project) => project.id === id) ?? null;
}
export async function visibleTask(user: Actor, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { rows } = await query<Task & { project_name: string; project_slug: string }>(
    `SELECT t.*, p.name AS project_name, p.slug AS project_slug
      FROM portal.tasks t JOIN portal.projects p ON p.id=t.project_id
      WHERE t.id::text=$1 AND ($3 <> 'client_admin' OR EXISTS (
        SELECT 1 FROM portal.memberships m WHERE m.project_id=t.project_id AND m.user_id::text=$2))`,
    [id, user.id, user.role]);
  return rows[0] ?? null;
}
export async function requireTask(user: Actor, id: string) {
  const task = await visibleTask(user, id);
  if (!task) notFound();
  return task;
}

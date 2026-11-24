import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { NewTaskForm } from './form';
import { createProjectTask, createTask } from '@/app/actions';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Create task' };
export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireActor();
  if (user.role === 'agency_member') notFound();
  const projects = await projectsFor(user);
  if (!projects.length) notFound();
  const { project } = await searchParams;
  const selected = project ? projects.find((item) => item.slug === project) : (projects.length === 1 ? projects[0] : undefined);
  if (project && !selected) notFound();
  const action = selected ? createProjectTask.bind(null, selected.id) : createTask;
  return <>
    <Link className="breadcrumb back-link task-back" href={selected ? '/projects/' + selected.slug : '/dashboard'}><ArrowLeft size={16} aria-hidden="true" /> {selected?.name ?? 'All projects'}</Link>
    <header className="page-header create-header"><div><h1>Create a task</h1><p>Set the brief and deadline for GHL Prime Team.</p></div></header>
    <NewTaskForm projects={projects} lockedProject={selected ? { id: selected.id, name: selected.name } : undefined} action={action} requestId={randomUUID()} />
  </>;
}

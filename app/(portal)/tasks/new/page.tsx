import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { NewTaskForm } from './form';
import { createProjectTask, createTask } from '@/app/actions';
import { ArrowLeft, ClipboardPlus } from 'lucide-react';

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
  return <div className="page-stack">
    <Link className="breadcrumb" href={selected ? '/projects/' + selected.slug : '/dashboard'}><ArrowLeft size={16} aria-hidden="true" /> {selected?.name ?? 'All projects'}</Link>
    <header className="page-header page-hero">
      <div className="hero-identity">
        <span className="hero-icon"><ClipboardPlus size={25} aria-hidden="true" /></span>
        <div><h1>Create a task</h1><p>Set the brief and deadline for GHL Prime Team.</p></div>
      </div>
    </header>
    <NewTaskForm projects={projects} lockedProject={selected ? { id: selected.id, name: selected.name } : undefined} action={action} requestId={randomUUID()} />
  </div>;
}

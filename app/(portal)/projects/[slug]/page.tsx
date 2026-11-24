import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { projectsFor, type Task } from '@/lib/access';
import { query } from '@/lib/db';
import { statuses, statusLabels, taskNumber } from '@/lib/rules';
import { Time } from '@/app/components';
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react';

export const metadata = { title: 'Project' };
export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireActor();
  const { slug } = await params;
  const project = (await projectsFor(user)).find(item => item.slug === slug);
  if (!project) notFound();
  const filters = await searchParams;
  const status = statuses.find(item => item === filters.status) ?? '';
  const page = /^[1-9]\d{0,4}$/.test(filters.page ?? '') ? Number(filters.page) : 1;
  const { rows: tasks } = await query<Pick<Task, 'id' | 'number' | 'title' | 'status' | 'due_at' | 'assignee'> & { overdue: boolean; due_soon: boolean }>(
    `SELECT id,number,title,status,due_at,assignee,
     due_at < statement_timestamp() AND status <> 'completed' AS overdue,
     due_at BETWEEN statement_timestamp() AND statement_timestamp() + interval '24 hours' AND status <> 'completed' AS due_soon FROM portal.tasks
     WHERE project_id=$1 AND ($2='' OR status::text=$2)
     ORDER BY (status='completed'),due_at,number LIMIT 51 OFFSET $3`, [project.id, status, (page - 1) * 50]);
  const pageUrl = (n: number) => `/projects/${project.slug}?` + new URLSearchParams({ status, page: String(n) });
  return <>
    <Link className="breadcrumb back-link" href="/dashboard">← All projects</Link>
    <header className="page-header project-hero"><div><p className="eyebrow">PROJECT WORKSPACE</p><h1>{project.name}</h1>
      <p>Every brief, update and deadline for this project.</p></div>
      {user.role !== 'agency_member' && <Link className="button" href={'/tasks/new?project=' + project.slug}><Plus size={17} aria-hidden="true" /> New task</Link>}
    </header>
    <section><div className="section-title"><div><p className="eyebrow">PROJECT TASKS</p><h2>Tasks</h2></div>
      <form className="filters"><select aria-label="Filter by status" name="status" defaultValue={status}>
        <option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
      </select><button className="button secondary">Filter</button></form></div>
      {tasks.length ? <div className="board-scroll"><div className="task-board">{(status ? [status] : statuses).map(column => {
        const cards = tasks.slice(0, 50).filter(task => task.status === column);
        return <section className="board-column" key={column} aria-label={statusLabels[column]}>
          <div className="board-column-heading"><span><i className={'status-dot ' + column} />{statusLabels[column]}</span><span className="board-count">{cards.length}</span></div>
          <div className="board-cards">{cards.length ? cards.map(task =>
            <Link href={'/tasks/' + task.id} className="task-card card" key={task.id}>
              <div className="task-card-top"><span className="task-id">{taskNumber(task.number)}</span><ArrowUpRight size={16} aria-hidden="true" /></div>
              <h3>{task.title}</h3><p>Assigned to {task.assignee}</p>
              <div className="task-card-footer"><span className="task-due"><CalendarDays size={15} aria-hidden="true" /><Time at={task.due_at.toISOString()} /></span></div>
              {task.overdue ? <small className="overdue">Overdue</small> : task.due_soon ? <small className="due-soon">Due within 24 hours</small> : null}
            </Link>) : <p className="board-empty">No tasks yet</p>}</div>
        </section>;
      })}</div></div> : <div className="card empty-state"><h3>No tasks here yet</h3><p>Tasks for this project will appear here.</p></div>}
      {(page > 1 || tasks.length > 50) && <nav className="pager" aria-label="Task pages">
        {page > 1 && <Link className="quiet" href={pageUrl(page - 1)}>Previous</Link>}<span>Page {page}</span>
        {tasks.length > 50 && <Link className="quiet" href={pageUrl(page + 1)}>Next</Link>}</nav>}
    </section>
  </>;
}

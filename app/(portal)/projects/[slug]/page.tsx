import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { projectsFor, type Task } from '@/lib/access';
import { query } from '@/lib/db';
import { canManageTaskContent, statuses, statusLabels, taskNumber } from '@/lib/rules';
import { Time } from '@/app/components';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Columns3, FolderKanban, Plus, SlidersHorizontal } from 'lucide-react';
import { ProjectAccessVault, projectAccessItems } from './vault';

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
  const [{ rows: tasks }, accessItems] = await Promise.all([
    query<Pick<Task, 'id' | 'number' | 'title' | 'status' | 'due_at' | 'assignee'> & { overdue: boolean; due_soon: boolean }>(
      `SELECT id,number,title,status,due_at,assignee,
       due_at < statement_timestamp() AND status <> 'completed' AS overdue,
       due_at BETWEEN statement_timestamp() AND statement_timestamp() + interval '24 hours' AND status <> 'completed' AS due_soon FROM portal.tasks
       WHERE project_id=$1 AND ($2='' OR status::text=$2)
       ORDER BY (status='completed'),due_at,number LIMIT 51 OFFSET $3`, [project.id, status, (page - 1) * 50]),
    projectAccessItems(project.id, user),
  ]);
  const projectUrl = '/projects/' + project.slug;
  const newTaskUrl = '/tasks/new?project=' + project.slug;
  const pageUrl = (n: number) => projectUrl + '?' + new URLSearchParams({ status, page: String(n) });
  const canCreate = canManageTaskContent(user.role);
  const visibleTasks = tasks.slice(0, 50);

  return (
    <div className="page-stack">
      <Link className="breadcrumb" href="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> All projects</Link>
      <header className="page-header page-hero">
        <div className="hero-identity">
          <span className="hero-icon"><FolderKanban size={25} aria-hidden="true" /></span>
          <div><p className="eyebrow">Project</p><h1>{project.name}</h1></div>
        </div>
        {canCreate && <Button asChild className="hero-action">
          <Link href={newTaskUrl}><Plus size={18} aria-hidden="true" /> New task</Link>
        </Button>}
      </header>
      <ProjectAccessVault key={project.id} projectId={project.id} items={accessItems} canEdit={canCreate} />
      <section aria-labelledby="task-board-heading">
        <div className="board-toolbar">
          <div className="board-title"><Columns3 size={21} aria-hidden="true" /><h2 id="task-board-heading">Task board</h2></div>
          <form className="filters">
            <NativeSelect aria-label="Filter by status" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </NativeSelect>
            <Button type="submit" variant="secondary"><SlidersHorizontal size={16} aria-hidden="true" /> Apply</Button>
          </form>
        </div>
        {visibleTasks.length ? (
          <div className="board-scroll" role="region" aria-label="Task status columns" tabIndex={0}>
            <div className="task-board" data-filtered={!!status}>
              {(status ? [status] : statuses).map(column => {
                const cards = visibleTasks.filter(task => task.status === column);
                return (
                  <section className="board-column" key={column} data-status={column} aria-label={statusLabels[column]}>
                    <div className="board-column-heading">
                      <h3><span className="status-dot" aria-hidden="true" />{statusLabels[column]}</h3>
                      <span className="board-count">{cards.length}</span>
                    </div>
                    <div className="board-cards">
                      {cards.length ? cards.map(task => (
                        <Link href={'/tasks/' + task.id} className="task-card card" key={task.id}>
                          <div className="task-card-top">
                            <span className="task-id">{taskNumber(task.number)}</span><ArrowUpRight size={16} aria-hidden="true" />
                          </div>
                          <h4>{task.title}</h4>
                          <p>{task.assignee}</p>
                          <div className="task-card-footer">
                            <span className="task-due"><CalendarDays size={15} aria-hidden="true" /><Time at={task.due_at.toISOString()} /></span>
                            {task.overdue && <small className="overdue">Overdue</small>}
                            {task.due_soon && <small className="due-soon">Due within 24 hours</small>}
                          </div>
                        </Link>
                      )) : <p className="board-empty">No tasks</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card empty-state">
            <span className="empty-icon"><Columns3 size={23} aria-hidden="true" /></span>
            <h3>{status || page > 1 ? 'No tasks match this view' : 'No tasks yet'}</h3>
            {status || page > 1 ? <Button asChild variant="secondary"><Link href={projectUrl}>Show all tasks</Link></Button>
              : canCreate ? <Button asChild><Link href={newTaskUrl}><Plus size={17} aria-hidden="true" /> Create a task</Link></Button>
                : <p>Tasks will appear here as they’re added to the project.</p>}
          </div>
        )}
        {(page > 1 || tasks.length > 50) && (
          <nav className="pager" aria-label="Task pages">
            {page > 1 && <Button asChild variant="secondary"><Link href={pageUrl(page - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</Link></Button>}
            <span>Page {page}</span>
            {tasks.length > 50 && <Button asChild variant="secondary"><Link href={pageUrl(page + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></Link></Button>}
          </nav>
        )}
      </section>
    </div>
  );
}

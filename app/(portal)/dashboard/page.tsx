import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { query } from '@/lib/db';
import { canManageTaskContent } from '@/lib/rules';
import { RedirectToast } from '@/app/components';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, Clock3, FolderKanban, ListTodo, Plus } from 'lucide-react';

export const metadata = { title: 'Dashboard' };
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireActor();
  const projects = await projectsFor(user);
  const { rows } = await query<{ project_id: string; total: number; open: number; due_soon: number }>(
    `SELECT project_id, count(*)::int AS total,
        count(*) FILTER (WHERE status <> 'completed')::int AS open,
        count(*) FILTER (WHERE status <> 'completed' AND due_at BETWEEN statement_timestamp()
          AND statement_timestamp() + interval '24 hours')::int AS due_soon
     FROM portal.tasks WHERE project_id = ANY($1::uuid[]) GROUP BY project_id`,
    [projects.map(project => project.id)],
  );
  const counts = new Map(rows.map(row => [row.project_id, row]));
  const stats = [
    { label: 'Projects', count: projects.length, icon: FolderKanban, tone: 'violet' },
    { label: 'Open tasks', count: rows.reduce((sum, row) => sum + row.open, 0), icon: ListTodo, tone: 'blue' },
    { label: 'Due within 24 hours', count: rows.reduce((sum, row) => sum + row.due_soon, 0), icon: Clock3, tone: 'amber' },
  ];
  return (
    <div className="page-stack">
      {user.role === 'super_admin' && (await searchParams).deleted === 'project' && <RedirectToast param="deleted" message="Project deleted." />}
      <header className="page-header page-hero dashboard-hero">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Project overview</h1>
          <p>Welcome back, {user.name.trim().split(/\s+/)[0]}.</p>
        </div>
        {canManageTaskContent(user.role) && projects.length > 0 && (
          <Button asChild className="hero-action">
            <Link href="/tasks/new"><Plus size={18} aria-hidden="true" /> New task</Link>
          </Button>
        )}
      </header>
      <ul className="stats-grid" aria-label="Workspace summary">
        {stats.map(({ label, count, icon: Icon, tone }) => (
          <li className="card stat-card" key={label}>
            <span className="stat-icon" data-tone={tone}><Icon size={20} aria-hidden="true" /></span>
            <div><span className="stat-label">{label}</span><strong>{count}</strong></div>
          </li>
        ))}
      </ul>
      <section className="project-section" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="section-heading">Your projects</h2>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project, index) => {
              const { open = 0, total = 0 } = counts.get(project.id) ?? {};
              const completed = total - open;
              const initials = project.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
              return (
                <Link className="project-card card" key={project.id} href={'/projects/' + project.slug}>
                  <div className="project-card-top">
                    <span className={'project-mark mark-' + index % 3} aria-hidden="true">{initials}</span>
                    <span className="project-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
                  </div>
                  <h3>{project.name}</h3>
                  <div className="project-progress">
                    <div><span>{open} open</span><span>{completed} completed</span></div>
                    <progress aria-label="Task completion" value={completed} max={total || 1} />
                  </div>
                  <span className="project-link">Open board <ArrowRight size={16} aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card empty-state">
            <span className="empty-icon"><FolderKanban size={22} aria-hidden="true" /></span>
            <h3>No projects yet</h3>
            <p>Your administrator can grant you access to a project.</p>
          </div>
        )}
      </section>
    </div>
  );
}

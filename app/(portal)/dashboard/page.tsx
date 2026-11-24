import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { query } from '@/lib/db';
import { ArrowRight, ArrowUpRight, FolderKanban, ListTodo, Plus, Sparkles } from 'lucide-react';

export const metadata = { title: 'Dashboard' };
export default async function Dashboard() {
  const user = await requireActor();
  const projects = await projectsFor(user);
  const { rows } = await query<{ project_id: string; total: number; open: number }>(
    `SELECT project_id, count(*)::int AS total, count(*) FILTER (WHERE status <> 'completed')::int AS open
     FROM portal.tasks WHERE project_id = ANY($1::uuid[]) GROUP BY project_id`, [projects.map(p => p.id)]);
  return <>
    <header className="page-header dashboard-header premium-welcome">
      <div><p className="eyebrow"><Sparkles size={14} aria-hidden="true" /> YOUR WORKSPACE</p><h1>Good to have you here, {user.name.split(' ')[0]}.</h1>
        <p>Everything you need to keep your projects moving, all in one place.</p></div>
      {user.role !== 'agency_member' && projects.length > 0 && <Link className="button" href="/tasks/new"><Plus size={17} aria-hidden="true" /> New task</Link>}
    </header>
    <div className="overview-strip premium-overview"><span><i><FolderKanban size={18} /></i><span><small>YOUR WORKSPACES</small><strong>{projects.length}</strong> projects</span></span>
      <span><i><ListTodo size={18} /></i><span><small>ACTIVE TASKS</small><strong>{rows.reduce((sum, row) => sum + row.open, 0)}</strong> open tasks</span></span></div>
    <section className="project-section"><div className="section-title"><div><p className="eyebrow">YOUR PROJECTS</p><h2>Pick up where you left off</h2></div></div>
      {projects.length ? <div className="project-grid">
        {projects.map((project, index) => {
          const count = rows.find(row => row.project_id === project.id);
          return <Link className="project-card card" key={project.id} href={'/projects/' + project.slug}>
            <div className="project-card-top"><span className={'project-mark mark-' + index % 3}>{project.name.slice(0, 1)}</span><span className="project-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span></div>
            <h3>{project.name}</h3><p>Project workspace</p>
            <div className="project-card-footer"><span>{count?.open ?? 0} open tasks</span><span className="project-link">View project <ArrowRight size={15} /></span></div>
          </Link>;
        })}
      </div> : <p className="empty card">Your administrator can grant access to a project.</p>}
    </section>
  </>;
}

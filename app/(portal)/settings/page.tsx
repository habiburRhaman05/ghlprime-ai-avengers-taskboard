import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { query } from '@/lib/db';
import { ActionForm } from '@/app/components';
import { changePassword, createProject, createUser, grantAccess, revokeAccess, stopAutomaticAccess } from '@/app/actions';
import { Input } from '@/components/ui/input';

export const metadata = { title: 'Settings' };
export default async function Settings() {
  const user = await requireActor();
  const projects = await projectsFor(user);
  const memberships = user.role === 'super_admin' ? (await query<{
    user_id: string; project_id: string; name: string; email: string; project_name: string;
  }>(`SELECT m.user_id,m.project_id,u.name,u.email,p.name AS project_name FROM portal.memberships m
      JOIN portal.users u ON u.id=m.user_id JOIN portal.projects p ON p.id=m.project_id
      ORDER BY p.name,u.name`)).rows : [];
  const automaticClients = user.role === 'super_admin' ? (await query<{ id: string; name: string; email: string }>(
    `SELECT id,name,email FROM portal.users WHERE role='client_admin' AND all_projects ORDER BY name,email`)).rows : [];
  return <>
    <header className="page-header"><div><p className="eyebrow">Workspace</p><h1>Settings</h1><p>Manage your account and project access.</p></div></header>
    <div className="detail-grid">
      <section className="card panel stack">
        <h2>Account</h2><p>{user.name}<br /><span className="muted">{user.email}</span></p>
        <ActionForm action={changePassword} submit="Save password">
          <label>New password<Input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Confirm password<Input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        </ActionForm>
      </section>
      <section className="card panel stack">
        <h2>Projects</h2>
        <ul className="clean">{projects.map((project) => <li key={project.id}>{project.name}</li>)}</ul>
        {user.role === 'super_admin' && <ActionForm action={createProject} submit="Create project">
          <label>New project name<Input name="name" minLength={2} maxLength={100} required /></label>
        </ActionForm>}
      </section>
      {user.role === 'super_admin' && <>
        <section className="card panel stack">
          <h2>Create user</h2>
          <p className="muted">Client admins receive access to all current and future projects by default. Choose a project to limit access. Agency members see all projects.</p>
          <ActionForm action={createUser} submit="Create user">
            <label>Full name<Input name="name" maxLength={100} required /></label>
            <label>Email<Input name="email" type="email" maxLength={254} required /></label>
            <label>Role<select name="role"><option value="client_admin">Client admin</option><option value="agency_member">Agency member</option></select></label>
            <label>Project access<select name="project" defaultValue="all"><option value="all">All projects (including future projects)</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Temporary password<Input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small>At least 12 characters. Share it securely with the user.</small></label>
          </ActionForm>
        </section>
        <section className="card panel stack">
          <h2>Grant access</h2>
          <p className="muted">Grant project access to an existing login account.</p>
          <ActionForm action={grantAccess} submit="Grant access">
            <label>Full name<Input name="name" maxLength={100} required /></label>
            <label>Email<Input name="email" type="email" maxLength={254} required /></label>
            <label>Role<select name="role"><option value="client_admin">Client admin</option><option value="agency_member">Agency member</option></select></label>
            <label>Project access<select name="project" defaultValue="all"><option value="all">All projects (including future projects)</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          </ActionForm>
        </section>
        <section className="card panel stack">
          <h2>Client project access</h2>
          {automaticClients.length > 0 && <><p className="muted">These clients automatically receive access to new projects. Individual project access can still be removed below.</p>
            <ul className="clean">{automaticClients.map(client => <li className="member" key={client.id}>
              <div><strong>{client.name}</strong><small>{client.email} · Automatic access to new projects</small></div>
              <ActionForm action={stopAutomaticAccess} submit="Stop automatic access" quiet><input type="hidden" name="user" value={client.id} /></ActionForm>
            </li>)}</ul></>}
          {memberships.length ? <ul className="clean">{memberships.map((member) => <li className="member" key={member.user_id + member.project_id}>
            <div><strong>{member.name}</strong><small>{member.email} · {member.project_name}</small></div>
            <ActionForm action={revokeAccess} submit="Remove access" quiet>
              <input type="hidden" name="user" value={member.user_id} />
              <input type="hidden" name="project" value={member.project_id} />
            </ActionForm></li>)}</ul> : <p className="muted">No client admins have project access yet.</p>}
        </section>
      </>}
    </div>
  </>;
}

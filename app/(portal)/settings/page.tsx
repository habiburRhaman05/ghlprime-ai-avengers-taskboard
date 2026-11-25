import Link from 'next/link';
import { ArrowUpRight, FolderKanban, KeyRound, Settings2, ShieldCheck, UserRound, UserRoundPlus, Users } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { projectsFor } from '@/lib/access';
import { query } from '@/lib/db';
import { ActionForm, RedirectToast } from '@/app/components';
import { changePassword, createProject, createUser, grantAccess, revokeAccess, stopAutomaticAccess } from '@/app/actions';
import { deleteMember } from '@/app/delete-actions';
import { DeleteDialog } from '@/app/delete-dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { NativeSelect } from '@/components/ui/native-select';
import { PanelHeading } from '@/app/panel-heading';

export const metadata = { title: 'Settings' };
export default async function Settings({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireActor();
  const projects = await projectsFor(user);
  const isAdmin = user.role === 'super_admin';
  const [{ rows: memberships }, { rows: automaticClients }, { rows: members }] = isAdmin ? await Promise.all([
    query<{ user_id: string; project_id: string; name: string; email: string; project_name: string }>(
      `SELECT m.user_id,m.project_id,u.name,u.email,p.name AS project_name FROM portal.memberships m
      JOIN portal.users u ON u.id=m.user_id JOIN portal.projects p ON p.id=m.project_id
      ORDER BY p.name,u.name`),
    query<{ id: string; name: string; email: string }>(
      `SELECT id,name,email FROM portal.users WHERE role='client_admin' AND all_projects ORDER BY name,email`),
    query<{ id: string; name: string; email: string; role: 'client_admin' | 'agency_member' }>(
      `SELECT id,name,email,role FROM portal.users WHERE role <> 'super_admin' ORDER BY name,email`),
  ]) : [{ rows: [] }, { rows: [] }, { rows: [] }];
  return <div className="page-stack">
    {isAdmin && (await searchParams).deleted === 'member' && <RedirectToast param="deleted" message="Member deleted." />}
    <header className="page-header page-hero">
      <div className="hero-identity">
        <span className="hero-icon"><Settings2 size={25} aria-hidden="true" /></span>
        <div><h1>Settings</h1><p>Manage your account and project access.</p></div>
      </div>
    </header>
    <div className="detail-grid">
      <section className="card panel stack">
        <PanelHeading icon={UserRound} title="Account" />
        <div className="profile-summary">
          <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
        </div>
        <ActionForm action={changePassword} submit="Save password">
          <label>New password<PasswordInput name="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Confirm password<PasswordInput name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        </ActionForm>
      </section>
      <section className="card panel stack">
        <PanelHeading icon={FolderKanban} title="Projects" />
        {projects.length ? <ul className="clean settings-projects">
          {projects.map(project => <li key={project.id}>
            <Link href={'/projects/' + project.slug}>{project.name}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </li>)}
        </ul> : <p className="muted">You don’t have access to any projects yet.</p>}
        {isAdmin && <ActionForm action={createProject} submit="Create project">
          <label>New project name<Input name="name" minLength={2} maxLength={100} required /></label>
        </ActionForm>}
      </section>
    </div>
    {isAdmin && <section className="stack" aria-labelledby="administration-heading">
      <h2 className="section-heading" id="administration-heading">User administration</h2>
      <div className="detail-grid">
        <section className="card panel stack full-panel">
          <PanelHeading icon={Users} title="Members" />
          {members.length ? <ul className="clean">{members.map(member => <li className="member" key={member.id}>
            <div><strong>{member.name}</strong><small>{member.email} · {member.role === 'agency_member' ? 'Agency member' : 'Client admin'}</small></div>
            <DeleteDialog kind="member" id={member.id} name={member.name + ' · ' + member.email} action={deleteMember} />
          </li>)}</ul> : <p className="muted">No members yet.</p>}
        </section>
        <section className="card panel stack">
          <PanelHeading icon={UserRoundPlus} title="Create user" />
          <p className="muted">Client admins start with access to all current and future projects. Choose one project to limit their access.</p>
          <ActionForm action={createUser} submit="Create user">
            <label>Full name<Input name="name" maxLength={100} required /></label>
            <label>Email<Input name="email" type="email" maxLength={254} required /></label>
            <label>Role<NativeSelect name="role"><option value="client_admin">Client admin</option><option value="agency_member">Agency member</option></NativeSelect></label>
            <label>Project access<NativeSelect name="project" defaultValue="all"><option value="all">All projects (including future projects)</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</NativeSelect></label>
            <label>Temporary password<PasswordInput name="password" minLength={12} maxLength={128} autoComplete="new-password" required /><small>At least 12 characters. Share it securely with the user.</small></label>
          </ActionForm>
        </section>
        <section className="card panel stack">
          <PanelHeading icon={KeyRound} title="Grant access" />
          <p className="muted">Grant project access to an existing login account.</p>
          <ActionForm action={grantAccess} submit="Grant access">
            <label>Full name<Input name="name" maxLength={100} required /></label>
            <label>Email<Input name="email" type="email" maxLength={254} required /></label>
            <label>Role<NativeSelect name="role"><option value="client_admin">Client admin</option><option value="agency_member">Agency member</option></NativeSelect></label>
            <label>Project access<NativeSelect name="project" defaultValue="all"><option value="all">All projects (including future projects)</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</NativeSelect></label>
          </ActionForm>
        </section>
        <section className="card panel stack full-panel">
          <PanelHeading icon={ShieldCheck} title="Client project access" />
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
      </div>
    </section>}
  </div>;
}

import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { requireTask } from '@/lib/access';
import { query } from '@/lib/db';
import { blockerLabels, canManageTaskContent, statusLabels, taskNumber } from '@/lib/rules';
import { Textarea } from '@/components/ui/textarea';
import { editTaskContent, postComment } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { ActionForm, CreatedToast, Time } from '@/app/components';
import { WorkflowForm } from './workflow-form';
import { Upload } from './upload';
import { ResourceForm, ResourceRemove, RevealPassword } from './resource-form';

export const metadata = { title: 'Task details' };
export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireActor();
  const { id } = await params;
  const task = await requireTask(user, id);
  const created = (await searchParams).created === '1';
  const [comments, media, events, resources] = await Promise.all([
    query<{ id: string; name: string; kind: string; body: string; created_at: Date }>(
      `SELECT c.id,u.name,c.kind,c.body,c.created_at FROM portal.comments c
        JOIN portal.users u ON u.id=c.author_id WHERE c.task_id=$1 ORDER BY c.created_at DESC,c.id DESC`, [id]),
    query<{ id: string; filename: string; bytes: number }>(
      'SELECT id,filename,bytes FROM portal.media WHERE task_id=$1 AND ready ORDER BY created_at', [id]),
    query<{ id: string; name: string; created_at: Date; details: { from: keyof typeof statusLabels; to: keyof typeof statusLabels } }>(
      `SELECT e.id,u.name,e.created_at,e.details FROM portal.events e
      JOIN portal.users u ON u.id=e.actor_id WHERE e.task_id=$1 ORDER BY e.id DESC LIMIT 30`, [id]),
    query<{ id: string; kind: 'access' | 'media_link'; label: string; url: string | null; account_email: string | null; note: string | null; has_password: boolean }>(
      `SELECT id,kind,label,url,account_email,note,(encrypted_password IS NOT NULL) AS has_password
       FROM portal.task_resources WHERE task_id=$1 ORDER BY created_at,id`, [id]),
  ]);
  const canEdit = canManageTaskContent(user.role);
  const mediaLinks = resources.rows.filter(item => item.kind === 'media_link');
  const accessItems = resources.rows.filter(item => item.kind === 'access');
  return <>
    {created && <CreatedToast />}
    <Link className="breadcrumb back-link" href={'/projects/' + task.project_slug}>← {task.project_name}</Link>
    <header className="page-header">
      <div><p className="eyebrow">{taskNumber(task.number)}</p><h1>{task.title}</h1><p>Assigned to {task.assignee}</p></div>
      <span className={'badge ' + task.status}>{statusLabels[task.status]}</span>
    </header>
    <div className="detail-grid task-grid">
      <div className="stack">
        <section className="card panel stack">
          <h2>Instructions</h2><p className="preserve">{task.instructions}</p>
          {task.checklist.length > 0 && <ul className="task-checklist">{task.checklist.map((step, index) => <li key={index}>{step}</li>)}</ul>}
          {task.reference_url && <a className="quiet" href={task.reference_url} target="_blank" rel="noreferrer">Open reference</a>}
          {canEdit && <details className="resource-add"><summary>Edit task content</summary>
            <ActionForm action={editTaskContent} submit="Save changes">
              <input type="hidden" name="taskId" value={id} />
              <label>Task title<Input name="title" defaultValue={task.title} minLength={3} maxLength={120} required /></label>
              <label>Instructions<Textarea name="instructions" defaultValue={task.instructions} maxLength={5000} required rows={5} /></label>
              <label>Checklist <small>One step per line, up to 12 steps.</small><Textarea name="checklist" defaultValue={task.checklist.join('\n')} maxLength={1932} rows={3} /></label>
              <label>Social caption<Textarea name="caption" defaultValue={task.caption ?? ''} maxLength={2200} rows={3} /></label>
              <label>Reference URL<Input name="referenceUrl" type="url" defaultValue={task.reference_url ?? ''} maxLength={1000} /></label>
            </ActionForm></details>}
        </section>
        <section className="card panel stack">
          <h2>Social content</h2>
          {task.caption ? <p className="preserve caption">{task.caption}</p> : <p className="muted">No caption provided.</p>}
          <h3>Media</h3>
          {media.rows.length > 0 && <ul className="clean">
            {media.rows.map((item) => <li key={item.id}><a href={'/api/media/' + item.id}>{item.filename}</a>
              <small className="muted"> · {Math.max(1, Math.round(item.bytes / 1024))} KB</small></li>)}
          </ul>}
          {mediaLinks.length > 0 && <ul className="resource-list">{mediaLinks.map(item => <li key={item.id}>
            <div><a href={item.url ?? '#'} target="_blank" rel="noreferrer">{item.label} ↗</a>{item.note && <p className="preserve muted">{item.note}</p>}</div>
            {canEdit && <ResourceRemove taskId={id} resourceId={item.id} />}
          </li>)}</ul>}
          {canEdit && <><ResourceForm taskId={id} kind="media_link" /><Upload taskId={id} /></>}
        </section>
        <section className="card panel stack">
          <h2>Updates and learnings</h2>
          <ActionForm action={postComment} submit="Post">
            <input type="hidden" name="taskId" value={id} />
            <label>Type<select name="kind"><option value="update">Progress update</option><option value="learning">Learning</option></select></label>
            <label>Message<Textarea name="body" maxLength={2500} required rows={3} /></label>
          </ActionForm>
          {comments.rows.map((entry) => <article className="comment" key={entry.id}>
            <div><strong>{entry.name}</strong><small>{entry.kind === 'learning' ? 'Learning' : 'Update'} · <Time at={entry.created_at.toISOString()} /></small></div>
            <p className="preserve">{entry.body}</p>
          </article>)}
        </section>
      </div>
      <div className="stack">
        <section className="card panel stack">
          <h2>Task status</h2>
          <dl><dt>Completion deadline</dt><dd><Time at={task.due_at.toISOString()} />
            {task.status !== 'completed' && task.due_at.getTime() < Date.now() && <small className="overdue">Overdue</small>}</dd>
            <dt>Blocker</dt><dd>{blockerLabels[task.blocker]}</dd>
            {task.blocker !== 'none' && <dd className="preserve muted">{task.blocker_note}</dd>}
          </dl>
          <WorkflowForm key={task.status + task.blocker + task.blocker_note} id={id} status={task.status}
            role={user.role} blocker={task.blocker} note={task.blocker_note} />
        </section>
        <section className="card panel stack">
          <h2>Access</h2>
          {task.access_url ? <a className="quiet" href={task.access_url} target="_blank" rel="noreferrer">{task.access_label}</a>
            : null}
          {accessItems.length > 0 ? <ul className="resource-list">{accessItems.map(item => <li key={item.id}>
            <div className="resource-details">{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a> : <strong>{item.label}</strong>}
              {item.account_email && <small>{item.account_email}</small>}{item.note && <p className="preserve muted">{item.note}</p>}
              {item.has_password && <RevealPassword id={item.id} />}</div>
            {canEdit && <ResourceRemove taskId={id} resourceId={item.id} />}
          </li>)}</ul> : !task.access_url && <p className="muted">No access items provided.</p>}
          {canEdit && <ResourceForm taskId={id} kind="access" />}
        </section>
        {events.rows.length > 0 && <section className="card panel stack">
          <h2>Activity</h2>
          <ul className="clean">{events.rows.map((event) => <li key={event.id}>
            <strong>{event.name}</strong> · {statusLabels[event.details.from]} to {statusLabels[event.details.to]}
            <small className="muted"><Time at={event.created_at.toISOString()} /></small>
          </li>)}</ul>
        </section>}
      </div>
    </div>
  </>;
}

import Link from 'next/link';
import { Activity, ArrowLeft, ArrowUpRight, CalendarClock, Download, FileText, Images, MessageSquare, Pencil, Send } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { requireTask } from '@/lib/access';
import { query } from '@/lib/db';
import { blockerLabels, canManageTaskContent, statusLabels, taskNumber } from '@/lib/rules';
import { Textarea } from '@/components/ui/textarea';
import { editTaskContent, postComment } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ActionForm, RedirectToast, Time } from '@/app/components';
import { deleteTask } from '@/app/delete-actions';
import { DeleteDialog } from '@/app/delete-dialog';
import { PanelHeading } from '@/app/panel-heading';
import { WorkflowForm } from './workflow-form';

import { MediaLinkForm, MediaLinkRemove } from './media-link-form';

export const metadata = { title: 'Task details' };
export default async function TaskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireActor();
  const { id } = await params;
  const task = await requireTask(user, id);
  const created = (await searchParams).created === '1';
  const [comments, media, events, { rows: mediaLinks }] = await Promise.all([
    query<{ id: string; name: string; kind: string; body: string; created_at: Date }>(
      `SELECT c.id,COALESCE(u.name,'Deleted member') AS name,c.kind,c.body,c.created_at FROM portal.comments c
        LEFT JOIN portal.users u ON u.id=c.author_id WHERE c.task_id=$1 ORDER BY c.created_at DESC,c.id DESC`, [id]),
    query<{ id: string; filename: string; bytes: number }>(
      'SELECT id,filename,bytes FROM portal.media WHERE task_id=$1 AND ready ORDER BY created_at', [id]),
    query<{ id: string; name: string; created_at: Date; details: { from: keyof typeof statusLabels; to: keyof typeof statusLabels } }>(
      `SELECT e.id,COALESCE(u.name,'Deleted member') AS name,e.created_at,e.details FROM portal.events e
      LEFT JOIN portal.users u ON u.id=e.actor_id WHERE e.task_id=$1 ORDER BY e.id DESC LIMIT 30`, [id]),
    query<{ id: string; label: string; url: string; note: string | null }>(
      `SELECT id,label,url,note FROM portal.task_resources
       WHERE task_id=$1 AND kind='media_link' ORDER BY created_at,id`, [id]),
  ]);
  const canEdit = canManageTaskContent(user.role);
  const overdue = task.status !== 'completed' && task.due_at.getTime() < Date.now();
  return <div className="page-stack">
    {created && <RedirectToast param="created" message="Task created successfully." />}
    <Link className="breadcrumb" href={'/projects/' + task.project_slug}><ArrowLeft size={16} aria-hidden="true" /> {task.project_name}</Link>
    <header className="page-header page-hero">
      <div>
        <div className="task-hero-meta"><span className="task-id">{taskNumber(task.number)}</span><span className={'badge ' + task.status}>{statusLabels[task.status]}</span></div>
        <h1>{task.title}</h1>
        <p>Assigned to {task.assignee}</p>
      </div>
      {user.role === 'super_admin' && <DeleteDialog kind="task" id={task.id} name={task.title} action={deleteTask} />}
    </header>
    <div className="detail-grid task-grid">
      <div className="stack">
        <section className="card panel stack">
          <PanelHeading icon={FileText} title="Instructions" />
          <p className="preserve">{task.instructions}</p>
          {task.checklist.length > 0 && <div className="stack compact-stack"><h3>Checklist</h3>
            <ol className="task-checklist">{task.checklist.map((step, index) => <li key={index}>{step}</li>)}</ol></div>}
          {task.reference_url && <a className="resource-link" href={task.reference_url} target="_blank" rel="noreferrer">Open reference <ArrowUpRight size={15} aria-hidden="true" /></a>}
          {canEdit && <details className="resource-add"><summary><Pencil size={15} aria-hidden="true" /> Edit task content</summary>
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
          <PanelHeading icon={Images} title="Content & media" />
          <h3>Social caption</h3>
          {task.caption ? <p className="preserve caption">{task.caption}</p> : <p className="muted">No caption provided.</p>}
          <h3>Media</h3>
          {media.rows.length > 0 && <ul className="resource-list">
            {media.rows.map(item => (
              <li key={item.id}>
                <a className="media-download" href={'/api/media/' + item.id}>
                  <span className="resource-details"><strong>{item.filename}</strong><small>{Math.max(1, Math.round(item.bytes / 1024))} KB</small></span>
                  <Download size={17} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>}
          {mediaLinks.length > 0 && <ul className="resource-list">{mediaLinks.map(item => <li key={item.id}>
            <div className="resource-details"><a className="resource-link" href={item.url} target="_blank" rel="noreferrer">{item.label} <ArrowUpRight size={15} aria-hidden="true" /></a>{item.note && <p className="preserve muted">{item.note}</p>}</div>
            {canEdit && <MediaLinkRemove taskId={id} resourceId={item.id} />}
          </li>)}</ul>}
          {canEdit && <MediaLinkForm taskId={id} />}
        </section>
        <section className="card panel stack">
          <PanelHeading icon={MessageSquare} title="Updates and learnings" />
          <ActionForm action={postComment} submit="Post update" submitIcon={<Send size={15} aria-hidden="true" />}>
            <input type="hidden" name="taskId" value={id} />
            <label>Type<NativeSelect name="kind"><option value="update">Progress update</option><option value="learning">Learning</option></NativeSelect></label>
            <label>Message<Textarea name="body" maxLength={2500} required rows={3} /></label>
          </ActionForm>
          {comments.rows.map((entry) => <article className="comment" key={entry.id}>
            <div className="comment-author">
              <span className="avatar" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
              <div><strong>{entry.name}</strong><small>{entry.kind === 'learning' ? 'Learning' : 'Update'} · <Time at={entry.created_at.toISOString()} /></small></div>
            </div>
            <p className="preserve">{entry.body}</p>
          </article>)}
        </section>
      </div>
      <div className="stack">
        <section className="card panel stack">
          <PanelHeading icon={CalendarClock} title="Task status" />
          <dl className="status-overview">
            <div><dt>Completion deadline</dt><dd><Time at={task.due_at.toISOString()} />{overdue && <small className="overdue">Overdue</small>}</dd></div>
            <div><dt>Blocker</dt><dd>{blockerLabels[task.blocker]}</dd>
              {task.blocker !== 'none' && <dd className="preserve muted">{task.blocker_note}</dd>}</div>
          </dl>
          <WorkflowForm key={task.status + task.blocker + task.blocker_note} id={id} status={task.status}
            role={user.role} blocker={task.blocker} note={task.blocker_note} />
        </section>
        {events.rows.length > 0 && <section className="card panel stack">
          <PanelHeading icon={Activity} title="Activity" />
          <ul className="clean">{events.rows.map((event) => <li key={event.id}>
            <strong>{event.name}</strong> · {statusLabels[event.details.from]} to {statusLabels[event.details.to]}
            <small className="muted"><Time at={event.created_at.toISOString()} /></small>
          </li>)}</ul>
        </section>}
      </div>
    </div>
  </div>;
}

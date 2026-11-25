'use client';

import { startTransition, useActionState, useEffect, useId, useState } from 'react';
import { ArrowRight, FileText, FolderKanban, Link2, LoaderCircle, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import type { FormResult } from '@/app/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { validDeadline } from '@/lib/rules';
import { parseNewTaskForm } from '@/lib/validation';
import { DeadlinePicker } from './deadline-picker';

const deadlineMessage = 'Choose a completion deadline at least 24 hours from now.';

export function NewTaskForm({ projects, lockedProject, action, requestId }: {
  projects: { id: string; name: string }[];
  lockedProject?: { id: string; name: string };
  action: (previous: FormResult, form: FormData) => Promise<FormResult>;
  requestId: string;
}) {
  const [result, run, pending] = useActionState(action, {});
  const [dueAt, setDueAt] = useState('');
  const [feedback, setFeedback] = useState<FormResult>({});
  const formId = useId();
  const errorId = formId + '-error';

  useEffect(() => {
    if (!result.error) return;
    setFeedback(result);
    toast.error(result.error, { id: 'task-validation' });
  }, [result]);

  function fieldId(field: string) {
    return formId + '-' + field;
  }

  function fieldProps(field: string) {
    const invalid = feedback.field === field;
    return {
      id: fieldId(field),
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? errorId : undefined,
    };
  }

  function reject(error: string, field: string) {
    setFeedback({ error, field });
    toast.error(error, { id: 'task-validation' });
    document.getElementById(fieldId(field))?.focus();
  }

  return (
    <form
      className="create-task-form"
      aria-busy={pending}
      noValidate
      onInput={() => { if (feedback.error) setFeedback({}); }}
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        form.set('dueAt', dueAt);
        const checked = parseNewTaskForm(form);
        if (!checked.success) {
          const issue = checked.error.issues[0];
          reject(issue.message, issue.path.join('.'));
          return;
        }
        if (!validDeadline(dueAt, Date.now())) {
          reject(deadlineMessage, 'dueAt');
          return;
        }
        setFeedback({});
        startTransition(() => run(form));
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <section className="card panel stack create-panel" aria-labelledby="task-details-heading">
        <div className="form-section-title">
          <span className="form-section-icon"><FileText size={18} aria-hidden="true" /></span>
          <h2 id="task-details-heading">Task details</h2>
        </div>
        <div className="fields">
          <div className="task-field">
            <label htmlFor={fieldId('projectId')}>Project</label>
            {lockedProject ? <>
              <span className="locked-project">
                <FolderKanban size={17} className="locked-project-folder" aria-hidden="true" />
                <Input id={fieldId('projectId')} readOnly value={lockedProject.name} aria-describedby="locked-project-help" />
                <LockKeyhole size={15} className="locked-project-lock" aria-hidden="true" />
              </span>
              <input type="hidden" name="projectId" value={lockedProject.id} />
              <small id="locked-project-help">Fixed to the current project.</small>
            </> : (
              <NativeSelect name="projectId" defaultValue="" required {...fieldProps('projectId')}>
                <option value="" disabled>Select a project</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </NativeSelect>
            )}
          </div>
          <label>Assigned to<Input readOnly value="GHL Prime Team" /></label>
        </div>
        <label>
          Task title
          <Input required name="title" minLength={3} maxLength={120} placeholder="Prepare next week’s campaign post" {...fieldProps('title')} />
        </label>
        <label>
          Instructions
          <Textarea required name="instructions" maxLength={5000} rows={5} placeholder="Describe what you need and how it should be delivered." {...fieldProps('instructions')} />
        </label>
        <DeadlinePicker id={fieldId('dueAt')} value={dueAt} disabled={pending}
          errorId={feedback.field === 'dueAt' ? errorId : undefined}
          onChange={value => { setDueAt(value); setFeedback({}); }} />
        <label>
          Checklist <small>Optional · one step per line, up to 12 steps</small>
          <Textarea name="checklist" rows={3} maxLength={1932} {...fieldProps('checklist')} />
        </label>
      </section>

      <section className="card panel stack create-panel" aria-labelledby="content-heading">
        <div className="form-section-title">
          <span className="form-section-icon lilac"><Link2 size={18} aria-hidden="true" /></span>
          <h2 id="content-heading">Content &amp; references</h2>
        </div>
        <label>
          Social media caption <small>Optional</small>
          <Textarea name="caption" rows={3} maxLength={2200} placeholder="Add the caption for this task." {...fieldProps('caption')} />
        </label>
        <label>
          Reference link <small>Optional</small>
          <Input name="referenceUrl" type="url" maxLength={1000} placeholder="https://" {...fieldProps('referenceUrl')} />
        </label>
        <p className="task-media-hint">Add labeled media links after creating the task.</p>
      </section>

      {feedback.error && <p className="error create-feedback" role="alert" id={errorId}>{feedback.error}</p>}
      <div className="form-submit">
        <Button type="submit" disabled={pending}>
          {pending ? <><LoaderCircle size={17} className="submit-spinner" aria-hidden="true" /> Creating task…</>
            : <>Create task <ArrowRight size={17} aria-hidden="true" /></>}
        </Button>
      </div>
    </form>
  );
}

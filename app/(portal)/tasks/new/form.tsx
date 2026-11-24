'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, FileText, FolderKanban, KeyRound, Link2, LoaderCircle, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FormResult } from '@/app/components';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { PasswordInput } from '@/components/ui/password-input';
import { Textarea } from '@/components/ui/textarea';
import { DAY_MS, localDeadlineIso, validDeadline } from '@/lib/rules';
import { MAX_ACCESS_ITEMS, parseNewTaskForm, type TaskAccessItem } from '@/lib/validation';

const blankItem: TaskAccessItem = { label: '', email: '', password: '', url: '', note: '' };
const deadlineMessage = 'Choose a completion deadline at least 24 hours from now.';
type AccessDraft = TaskAccessItem & { key: number };

export function NewTaskForm({ projects, lockedProject, action, requestId }: {
  projects: { id: string; name: string }[];
  lockedProject?: { id: string; name: string };
  action: (previous: FormResult, form: FormData) => Promise<FormResult>;
  requestId: string;
}) {
  const [result, run, pending] = useActionState(action, {});
  const [day, setDay] = useState<Date>();
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [accessItems, setAccessItems] = useState<AccessDraft[]>([{ ...blankItem, key: 0 }]);
  const nextItemKey = useRef(1);
  const [feedback, setFeedback] = useState<FormResult>({});
  const formId = useId();
  const errorId = formId + '-error';
  const deadlineHelpId = formId + '-deadline-help';
  const dueAt = localDeadlineIso(day, time);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

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
    const focus = field === 'dueAt' ? (day ? 'time' : 'day') : field;
    document.getElementById(fieldId(focus))?.focus();
  }

  function editItem(key: number, field: keyof TaskAccessItem, value: string) {
    setAccessItems(items => items.map(item => item.key === key ? { ...item, [field]: value } : item));
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
        form.set('accessItems', JSON.stringify(accessItems.map(({ key: _, ...item }) => item)));
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
        <fieldset className="deadline-field">
          <legend>Completion deadline</legend>
          <div className="fields">
            <div className="task-field">
              <label htmlFor={fieldId('day')}>Date</label>
              <DatePicker
                id={fieldId('day')}
                value={day}
                earliestDay={new Date(Date.now() + DAY_MS)}
                describedBy={feedback.field === 'dueAt' && !day ? errorId : deadlineHelpId}
                invalid={feedback.field === 'dueAt' && !day}
                disabled={pending}
                onChange={date => { setDay(date); setFeedback({}); }}
              />
            </div>
            <label>
              Time
              <Input
                id={fieldId('time')}
                className="deadline-time"
                type="time"
                step={60}
                required
                value={time}
                onChange={event => setTime(event.target.value)}
                aria-invalid={(feedback.field === 'dueAt' && !!day) || undefined}
                aria-describedby={feedback.field === 'dueAt' && day ? errorId : deadlineHelpId}
              />
            </label>
          </div>
          <small id={deadlineHelpId}>Choose a time at least 24 hours after creating the task{timezone ? ' · ' + timezone : ''}.</small>
        </fieldset>
        <label>
          Checklist <small>Optional · one step per line, up to 12 steps</small>
          <Textarea name="checklist" rows={3} maxLength={1932} {...fieldProps('checklist')} />
        </label>
      </section>

      <section className="card panel stack create-panel" aria-labelledby="content-heading">
        <div className="form-section-title">
          <span className="form-section-icon lilac"><Link2 size={18} aria-hidden="true" /></span>
          <h2 id="content-heading">Content &amp; access</h2>
        </div>
        <label>
          Social media caption <small>Optional</small>
          <Textarea name="caption" rows={3} maxLength={2200} placeholder="Add the caption for this task." {...fieldProps('caption')} />
        </label>
        <label>
          Reference link <small>Optional</small>
          <Input name="referenceUrl" type="url" maxLength={1000} placeholder="https://" {...fieldProps('referenceUrl')} />
        </label>
        <section className="access-editor stack" aria-labelledby="access-items-heading">
          <div>
            <h3 id="access-items-heading"><KeyRound size={16} aria-hidden="true" /> Access items</h3>
            <small>Optional · Add the platforms or accounts needed for this task.</small>
          </div>
          {accessItems.map((item, index) => {
            const name = (field: keyof TaskAccessItem) => `accessItems.${index}.${field}`;
            return (
              <div
                className="access-item"
                role="group"
                aria-labelledby={formId + '-item-' + item.key}
                key={item.key}
              >
                <div className="access-item-heading">
                  <strong id={formId + '-item-' + item.key}>Access item {index + 1}</strong>
                  <Button
                    variant="ghost"
                    className="access-item-remove"
                    type="button"
                    disabled={pending}
                    aria-label={`Remove access item ${index + 1}`}
                    onClick={() => {
                      setAccessItems(items => items.filter(value => value.key !== item.key));
                      setFeedback({});
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
                <label>
                  Label
                  <Input
                    placeholder="e.g. Meta Business Suite"
                    maxLength={100}
                    value={item.label}
                    onChange={event => editItem(item.key, 'label', event.target.value)}
                    {...fieldProps(name('label'))}
                  />
                </label>
                <div className="fields access-credentials">
                  <label>
                    Email
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="name@company.com"
                      maxLength={254}
                      value={item.email}
                      onChange={event => editItem(item.key, 'email', event.target.value)}
                      {...fieldProps(name('email'))}
                    />
                  </label>
                  <div className="task-field">
                    <label htmlFor={fieldId(name('password'))}>Password</label>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Enter password"
                      maxLength={512}
                      value={item.password}
                      onChange={event => editItem(item.key, 'password', event.target.value)}
                      {...fieldProps(name('password'))}
                    />
                  </div>
                </div>
                <label>
                  Restricted link <small>Optional</small>
                  <Input
                    type="url"
                    placeholder="https://"
                    maxLength={1000}
                    value={item.url}
                    onChange={event => editItem(item.key, 'url', event.target.value)}
                    {...fieldProps(name('url'))}
                  />
                </label>
                <label>
                  Instructions or note <small>Optional</small>
                  <Textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. Open the March campaign in this account."
                    value={item.note}
                    onChange={event => editItem(item.key, 'note', event.target.value)}
                    {...fieldProps(name('note'))}
                  />
                </label>
              </div>
            );
          })}
          <Button
            variant="secondary"
            className="add-access-item"
            type="button"
            disabled={pending || accessItems.length >= MAX_ACCESS_ITEMS}
            onClick={() => {
              const key = nextItemKey.current++;
              setAccessItems(items => [...items, { ...blankItem, key }]);
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {accessItems.length ? 'Add another access item' : 'Add access item'}
          </Button>
          {accessItems.length >= MAX_ACCESS_ITEMS && <small>You can add up to {MAX_ACCESS_ITEMS} access items.</small>}
        </section>
        <p className="task-media-hint">Attach files or labeled media links on the task after creating it.</p>
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

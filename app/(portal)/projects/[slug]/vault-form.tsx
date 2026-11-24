'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ActionForm, type FormResult } from '@/app/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_ACCESS_ITEMS, parseProjectAccessForm, type ProjectAccessDraft } from '@/lib/validation';

type VaultAction = (previous: FormResult, form: FormData) => Promise<FormResult>;
type Draft = ProjectAccessDraft & { key: number };
const blankItem: Draft = { key: 0, label: '', email: '', password: '', url: '', note: '' };

export function AddAccessItems({ projectId, action }: { projectId: string; action: VaultAction }) {
  const [outcome, run, pending] = useActionState(action, {});
  const [drafts, setDrafts] = useState<Draft[]>([blankItem]);
  const [feedback, setFeedback] = useState<FormResult>({});
  const nextKey = useRef(1);
  const details = useRef<HTMLDetailsElement>(null);
  const formId = useId();
  const errorId = formId + '-error';

  useEffect(() => {
    if (outcome.error) {
      setFeedback(outcome);
      toast.error(outcome.error);
    }
    if (outcome.ok) {
      setDrafts([{ ...blankItem, key: nextKey.current++ }]);
      if (details.current) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
      toast.success(outcome.ok);
    }
  }, [outcome]);

  function changeItem(key: number, field: keyof ProjectAccessDraft, value: string) {
    setDrafts(items => items.map(item => item.key === key ? { ...item, [field]: value } : item));
    setFeedback({});
  }

  function fieldProps(index: number, field: keyof ProjectAccessDraft) {
    const path = 'accessItems.' + index + '.' + field;
    const invalid = feedback.field === path;
    return { id: formId + '-' + path, 'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? errorId : undefined };
  }

  return <details className="resource-add vault-add" ref={details}>
    <summary><Plus size={17} aria-hidden="true" /> Add access items</summary>
    <form className="stack" aria-busy={pending} noValidate onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const form = new FormData();
      form.set('projectId', projectId);
      form.set('accessItems', JSON.stringify(drafts.map(({ key: _, ...item }) => item)));
      const checked = parseProjectAccessForm(form);
      if (!checked.success) {
        const issue = checked.error.issues[0];
        const field = issue.path.join('.');
        setFeedback({ error: issue.message, field });
        toast.error(issue.message);
        document.getElementById(formId + '-' + field)?.focus();
        return;
      }
      setFeedback({});
      startTransition(() => run(form));
    }}>
      <fieldset className="vault-fields stack" disabled={pending}>
        {drafts.map((item, index) => (
          <div key={item.key} className="access-item" role="group" aria-labelledby={formId + '-item-' + item.key}>
            <div className="access-item-heading">
              <strong id={formId + '-item-' + item.key}>Access item {index + 1}</strong>
              {drafts.length > 1 && <Button className="access-item-remove" variant="ghost" type="button"
                aria-label={'Remove draft access item ' + (index + 1)} onClick={() => {
                  setDrafts(items => items.filter(entry => entry.key !== item.key));
                  setFeedback({});
                }}>
                <Trash2 size={16} aria-hidden="true" />
              </Button>}
            </div>
            <div className="fields">
              <label>Platform label
                <Input placeholder="e.g. Meta Business Suite" required maxLength={100} value={item.label}
                  onChange={event => changeItem(item.key, 'label', event.target.value)} {...fieldProps(index, 'label')} />
              </label>
              <label>Account email <small>Optional</small>
                <Input type="email" placeholder="name@company.com" maxLength={254} autoComplete="off" value={item.email}
                  onChange={event => changeItem(item.key, 'email', event.target.value)} {...fieldProps(index, 'email')} />
              </label>
              <label>Restricted link <small>Optional</small>
                <Input type="url" placeholder="https://" maxLength={1000} value={item.url}
                  onChange={event => changeItem(item.key, 'url', event.target.value)} {...fieldProps(index, 'url')} />
              </label>
              <div className="task-field">
                <label htmlFor={fieldProps(index, 'password').id}>Password <small>Optional · encrypted at rest</small></label>
                <PasswordInput autoComplete="new-password" maxLength={512} value={item.password}
                  onChange={event => changeItem(item.key, 'password', event.target.value)} {...fieldProps(index, 'password')} />
              </div>
            </div>
            <label>Instructions or note <small>Optional</small>
              <Textarea rows={2} maxLength={2000} value={item.note}
                onChange={event => changeItem(item.key, 'note', event.target.value)} {...fieldProps(index, 'note')} />
            </label>
          </div>
        ))}
      </fieldset>
      {feedback.error && <p className="error" role="alert" id={errorId}>{feedback.error}</p>}
      <div className="vault-form-actions">
        <Button variant="secondary" type="button" disabled={pending || drafts.length >= MAX_ACCESS_ITEMS} onClick={() => {
          const key = nextKey.current++;
          setDrafts(items => [...items, { ...blankItem, key }]);
        }}>
          <Plus size={16} aria-hidden="true" /> Add another
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <><LoaderCircle size={17} className="submit-spinner" aria-hidden="true" /> Saving…</> : 'Save access items'}
        </Button>
      </div>
    </form>
  </details>;
}

export function RemoveAccessItem({ itemId, label, action }: { itemId: string; label: string; action: VaultAction }) {
  return <ActionForm action={action} submit="Remove" submitIcon={<span className="sr-only">{label}</span>} quiet>
    <input type="hidden" name="itemId" value={itemId} />
  </ActionForm>;
}

export function RevealPassword({ id }: { id: string }) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  return <div className="resource-password">
    {value && <code>{value}</code>}
    <Button variant="link" type="button" disabled={pending} aria-expanded={!!value} onClick={async () => {
      if (value) {
        setValue('');
        return;
      }
      setPending(true);
      try {
        const response = await fetch('/api/project-access/' + id + '/password', { cache: 'no-store' });
        if (!response.ok) throw new Error('Password unavailable.');
        const result = await response.json();
        setValue(result.password);
      } catch {
        toast.error('Password unavailable.');
      } finally {
        setPending(false);
      }
    }}>
      {value ? <><EyeOff size={16} aria-hidden="true" /> Hide password</> : <><Eye size={16} aria-hidden="true" /> {pending ? 'Loading…' : 'Show password'}</>}
    </Button>
  </div>;
}

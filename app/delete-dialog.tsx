'use client';

import { useActionState, useEffect, useId, useRef } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { FormResult } from '@/app/components';

const deletionDetails = {
  task: 'This permanently removes the task, its comments, activity, and attachments.',
  project: 'This permanently removes the project, all its tasks and attachments, its access vault, and its memberships.',
  member: 'This permanently removes the login and all project memberships. Their existing work remains in the portal.',
};

export function DeleteDialog({ kind, id, name, action }: {
  kind: keyof typeof deletionDetails;
  id: string;
  name: string;
  action: (previous: FormResult, form: FormData) => Promise<FormResult>;
}) {
  const [result, submit, pending] = useActionState(action, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detailsId = useId();
  const label = 'Delete ' + kind;

  useEffect(() => {
    if (result.error) toast.error(result.error);
  }, [result]);

  return <>
    <Button variant="secondary" className="delete-trigger" type="button" aria-haspopup="dialog"
      aria-label={label + ' ' + name} onClick={() => dialog.current?.showModal()}>
      <Trash2 size={16} aria-hidden="true" /> {label}
    </Button>
    <dialog ref={dialog} className="delete-dialog" aria-labelledby={titleId} aria-describedby={detailsId}
      onCancel={event => { if (pending) event.preventDefault(); }}>
      <form action={submit} className="stack" aria-busy={pending}>
        <h2 id={titleId}>{label}?</h2>
        <p id={detailsId}><strong>{name}</strong><span>{deletionDetails[kind]}</span></p>
        <input type="hidden" name="id" value={id} />
        {result.error && <p className="error" role="alert">{result.error}</p>}
        <div className="delete-dialog-actions">
          <Button variant="secondary" type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button variant="destructive" type="submit" disabled={pending}>
            {pending ? <><LoaderCircle size={16} className="submit-spinner" aria-hidden="true" /> Deleting…</> : label}
          </Button>
        </div>
      </form>
    </dialog>
  </>;
}

'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export type FormResult = { error?: string; field?: string; ok?: string };
type Action = (previous: FormResult, form: FormData) => Promise<FormResult>;

export function ActionForm({ action, children, submit, submitIcon, className, quiet = false }: {
  action: Action; children?: React.ReactNode; submit: string; submitIcon?: React.ReactNode; className?: string; quiet?: boolean;
}) {
  const [result, handle, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result.ok) { form.current?.reset(); toast.success(result.ok); }
    if (result.error) toast.error(result.error);
  }, [result]);
  return <form ref={form} className={className ?? 'stack'} aria-busy={pending} onInvalid={(event) => {
    const field = event.target as HTMLInputElement;
    toast.error(field.validationMessage || 'Please check the highlighted field.', { id: 'form-validation' });
  }} onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => handle(data));
  }}>
    {children}
    {result.error && <p className="error" role="alert">{result.error}</p>}
    {result.ok && <p className="success" role="status">{result.ok}</p>}
    <div className="action-buttons">
      <Button variant={quiet ? 'link' : 'default'} type="submit" disabled={pending}>
        {pending ? <><LoaderCircle className="submit-spinner" size={16} aria-hidden="true" /> Working…</> : <>{submit}{submitIcon}</>}
      </Button>
    </div>
  </form>;
}

const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export function Time({ at }: { at: string }) {
  const [text, setText] = useState(at.replace('T', ' ').slice(0, 16) + ' UTC');
  useEffect(() => setText(formatter.format(new Date(at))), [at]);
  return <time dateTime={at}>{text}</time>;
}

export function RedirectToast({ param, message }: { param: string; message: string }) {
  useEffect(() => {
    toast.success(message, { id: param + '-' + message });
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, '', url);
  }, [param, message]);
  return null;
}

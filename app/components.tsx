'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export type FormResult = { error?: string; field?: string; ok?: string };
type Action = (previous: FormResult, form: FormData) => Promise<FormResult>;

export function ActionForm({ action, children, submit, className, quiet = false }: {
  action: Action; children?: React.ReactNode; submit: string; className?: string; quiet?: boolean;
}) {
  const [result, handle, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result.ok) { form.current?.reset(); toast.success(result.ok); }
    if (result.error) toast.error(result.error);
  }, [result]);
  return <form ref={form} className={className ?? 'stack'} onInvalid={(event) => {
    const field = event.target as HTMLInputElement;
    toast.error(field.validationMessage || 'Please check the highlighted field.', { id: 'form-validation' });
  }} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => handle(data));
  }}>
    {children}
    {result.error && <p className="error" role="alert">{result.error}</p>}
    {result.ok && <p className="success" role="status">{result.ok}</p>}
    <div><Button variant={quiet ? 'link' : 'default'} disabled={pending}>{pending ? 'Working…' : submit}</Button></div>
  </form>;
}

const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export function Time({ at }: { at: string }) {
  const [text, setText] = useState(at.replace('T', ' ').slice(0, 16) + ' UTC');
  useEffect(() => setText(formatter.format(new Date(at))), [at]);
  return <time dateTime={at}>{text}</time>;
}

export function CreatedToast() {
  useEffect(() => {
    toast.success('Task created successfully.', { id: 'task-created' });
    const url = new URL(window.location.href);
    url.searchParams.delete('created');
    window.history.replaceState(window.history.state, '', url);
  }, []);
  return null;
}

'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActionForm } from '@/app/components';
import { addTaskResource, removeTaskResource } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function ResourceForm({ taskId, kind }: { taskId: string; kind: 'access' | 'media_link' }) {
  const access = kind === 'access';
  return <details className="resource-add"><summary>{access ? '+ Add access item' : '+ Add media link'}</summary>
    <ActionForm action={addTaskResource} submit={access ? 'Save access item' : 'Save media link'}>
      <input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="kind" value={kind} />
      <label>{access ? 'Platform name' : 'Link label'}<Input name="label" maxLength={100} required placeholder={access ? 'e.g. Meta Business Suite' : 'e.g. Test video'} /></label>
      <label>{access ? 'Platform or vault URL (optional)' : 'Media URL'}<Input name="url" type="url" maxLength={1000} required={!access} placeholder="https://" /></label>
      {access && <><label>Account email <small>Optional</small><Input name="email" type="email" maxLength={254} autoComplete="off" /></label>
        <label>Password <small>Optional · encrypted before storage</small><Input name="password" type="password" maxLength={512} autoComplete="new-password" /></label></>}
      <label>Instructions or note <small>Optional</small><Textarea name="note" maxLength={2000} rows={2} /></label>
    </ActionForm></details>;
}

export function ResourceRemove({ taskId, resourceId }: { taskId: string; resourceId: string }) {
  return <ActionForm action={removeTaskResource} submit="Remove" quiet>
    <input type="hidden" name="taskId" value={taskId} /><input type="hidden" name="resourceId" value={resourceId} />
  </ActionForm>;
}

export function RevealPassword({ id }: { id: string }) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  return value ? <div className="resource-password"><code>{value}</code><button type="button" className="quiet" onClick={() => setValue('')}>Hide</button></div> :
    <button type="button" className="quiet" disabled={pending} onClick={async () => {
      setPending(true);
      try {
        const response = await fetch(`/api/resources/${id}/password`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Password unavailable.');
        const result = await response.json(); setValue(result.password);
      } catch { toast.error('Password unavailable.'); } finally { setPending(false); }
    }}>{pending ? 'Loading…' : 'Show password'}</button>;
}

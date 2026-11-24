import { Plus } from 'lucide-react';
import { ActionForm } from '@/app/components';
import { addTaskMediaLink, removeTaskMediaLink } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function MediaLinkForm({ taskId }: { taskId: string }) {
  return <details className="resource-add">
    <summary><Plus size={17} aria-hidden="true" /> Add media link</summary>
    <ActionForm action={addTaskMediaLink} submit="Save media link">
      <input type="hidden" name="taskId" value={taskId} />
      <label>Link label<Input name="label" maxLength={100} required placeholder="e.g. Test video" /></label>
      <label>Media URL<Input name="url" type="url" maxLength={1000} required placeholder="https://" /></label>
      <label>Instructions or note <small>Optional</small><Textarea name="note" maxLength={2000} rows={2} /></label>
    </ActionForm>
  </details>;
}

export function MediaLinkRemove({ taskId, resourceId }: { taskId: string; resourceId: string }) {
  return <ActionForm action={removeTaskMediaLink} submit="Remove" quiet>
    <input type="hidden" name="taskId" value={taskId} />
    <input type="hidden" name="resourceId" value={resourceId} />
  </ActionForm>;
}

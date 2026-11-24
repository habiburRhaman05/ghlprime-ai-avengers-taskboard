'use client';
import { useState } from 'react';
import { ActionForm } from '@/app/components';
import { updateTask } from '@/app/actions';
import { blockerLabels, blockers, canTransition, statusLabels, statuses, type Blocker, type Role, type Status } from '@/lib/rules';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';

export function WorkflowForm({ id, status, role, blocker, note }: {
  id: string; status: Status; role: Role; blocker: Blocker; note: string;
}) {
  const [selected, setSelected] = useState(status);
  return <ActionForm action={updateTask} submit="Update task">
    <input type="hidden" name="taskId" value={id} />
    <label>Status<NativeSelect name="status" value={selected} onChange={(event) => setSelected(event.target.value as Status)}>
      {statuses.filter((value) => canTransition(role, status, value)).map((value) =>
        <option key={value} value={value}>{statusLabels[value]}</option>)}
    </NativeSelect></label>
    {selected === 'blocked' && <>
      <label>Who needs to act?<NativeSelect name="blocker" required defaultValue={blocker === 'none' ? '' : blocker}>
        <option disabled value="">Select a blocker owner</option>
        {blockers.filter((value) => value !== 'none').map((value) =>
          <option key={value} value={value}>{blockerLabels[value]}</option>)}
      </NativeSelect></label>
      <label>What is needed?<Textarea name="note" rows={3} maxLength={1000} required defaultValue={note} /></label>
    </>}
    {selected !== 'blocked' && <><input type="hidden" name="blocker" value="none" /><input type="hidden" name="note" value="" /></>}
  </ActionForm>;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const statuses = ['assigned', 'in_progress', 'blocked', 'ready_for_review', 'completed'] as const;
export const blockers = ['none', 'client', 'agency', 'external'] as const;
export const roles = ['super_admin', 'agency_member', 'client_admin'] as const;
export type Role = typeof roles[number];
export type Status = typeof statuses[number];
export type Blocker = typeof blockers[number];

export function workflowFormFields(form: FormData) {
  const read = (key: string) => String(form.get(key) ?? '');
  const status = read('status');
  const blocker = read('blocker');
  return {
    taskId: read('taskId'), status,
    blocker: !blocker && status !== 'blocked' ? 'none' : blocker,
    note: read('note'),
  };
}

export function canManageTaskContent(role: Role) {
  return role !== 'agency_member';
}

export const statusLabels: Record<Status, string> = {
  assigned: 'Assigned', in_progress: 'In progress', blocked: 'Blocked',
  ready_for_review: 'Ready for review', completed: 'Completed',
};
export const blockerLabels: Record<Blocker, string> = {
  none: 'No blocker', client: 'Waiting on the client',
  agency: 'Waiting on GHL Prime Team', external: 'Waiting on a third party',
};
export const transitions: Record<Status, Status[]> = {
  assigned: ['in_progress', 'blocked'],
  in_progress: ['blocked', 'ready_for_review'],
  blocked: ['in_progress'],
  ready_for_review: ['blocked', 'in_progress', 'completed'],
  completed: ['in_progress'],
};
export function canTransition(role: Role, current: Status, next: Status) {
  if (current === next) return true;
  if (!transitions[current].includes(next)) return false;
  if (current === 'completed' || next === 'completed') return role !== 'agency_member';
  return true;
}
export function taskNumber(number: string | number) {
  return 'TASK-' + String(number).padStart(3, '0');
}
export function validDeadline(value: string, now: number) {
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline >= now + DAY_MS;
}

export function localDeadlineIso(day: Date | undefined, time: string) {
  if (!day || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const local = new Date(day);
  local.setHours(hours, minutes, 0, 0);
  // A clock change can skip the requested local time.
  if (local.getHours() !== hours || local.getMinutes() !== minutes) return '';
  return local.toISOString();
}

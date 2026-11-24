import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY_MS, validDeadline, localDeadlineIso, canManageTaskContent, canTransition, taskNumber, workflowFormFields } from '../lib/rules.ts';
import { matchingMedia } from '../lib/media.ts';

const iso = (time) => new Date(time).toISOString();
const created = Date.parse('2026-11-23T12:00:00Z');
test('the completion deadline has an inclusive 24 elapsed hour minimum', () => {
  for (const hours of [1, 2, 23]) assert.equal(validDeadline(iso(created + hours * 3600000), created), false);
  assert.equal(validDeadline(iso(created + DAY_MS - 1), created), false);
  assert.equal(validDeadline(iso(created + DAY_MS), created), true);
  assert.equal(validDeadline(iso(created + DAY_MS + 1), created), true);
  assert.equal(validDeadline('invalid', created), false);
});
test('a calendar day across the spring clock change can be shorter than 24 hours', () => {
  const before = Date.parse('2026-03-07T12:00:00-05:00');
  assert.equal(validDeadline('2026-03-08T12:00:00-04:00', before), false);
  assert.equal(validDeadline('2026-03-08T13:00:00-04:00', before), true);
});
test('the calendar date and time input use local time and serialize to UTC', () => {
  const day = new Date(2026, 10, 26);
  assert.equal(localDeadlineIso(day, '19:11'), new Date(2026, 10, 26, 19, 11).toISOString());
  assert.equal(localDeadlineIso(day, '24:00'), '');
  assert.equal(localDeadlineIso(undefined, '19:11'), '');
});
test('workflows require review and reserve approval/reopening for admins', () => {
  assert.equal(canTransition('agency_member', 'assigned', 'completed'), false);
  assert.equal(canTransition('agency_member', 'in_progress', 'ready_for_review'), true);
  assert.equal(canTransition('agency_member', 'ready_for_review', 'completed'), false);
  assert.equal(canTransition('client_admin', 'ready_for_review', 'completed'), true);
  assert.equal(canTransition('client_admin', 'completed', 'in_progress'), true);
  assert.equal(canTransition('super_admin', 'blocked', 'in_progress'), true);
  assert.equal(canTransition('client_admin', 'blocked', 'completed'), false);
});
test('agency members can update progress but cannot manage task content', () => {
  assert.equal(canManageTaskContent('agency_member'), false);
  assert.equal(canManageTaskContent('client_admin'), true);
  assert.equal(canManageTaskContent('super_admin'), true);
  assert.equal(canTransition('agency_member', 'assigned', 'in_progress'), true);
  assert.equal(canTransition('agency_member', 'in_progress', 'blocked'), true);
});
test('workflow forms default an absent blocker only for non-blocked statuses', () => {
  const form = new FormData();
  form.set('taskId', 'synthetic-task');
  form.set('status', 'in_progress');
  assert.deepEqual(workflowFormFields(form), { taskId: 'synthetic-task', status: 'in_progress', blocker: 'none', note: '' });
  form.set('status', 'blocked');
  assert.equal(workflowFormFields(form).blocker, '');
  form.set('blocker', 'client');
  form.set('note', 'Waiting on a synthetic response');
  assert.equal(workflowFormFields(form).blocker, 'client');
  form.set('status', 'in_progress');
  assert.equal(workflowFormFields(form).blocker, 'client');
});
test('display IDs stay stable across number widths', () => {
  assert.equal(taskNumber('1'), 'TASK-001');
  assert.equal(taskNumber(20), 'TASK-020');
  assert.equal(taskNumber('1001'), 'TASK-1001');
});
test('media signature checks reject a mislabeled file', () => {
  assert.equal(matchingMedia(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
  assert.equal(matchingMedia(Uint8Array.from([137, 80, 78]), 'image/png'), false);
  assert.equal(matchingMedia(Buffer.from('<svg></svg>'), 'image/png'), false);
  assert.equal(matchingMedia(Buffer.from('0000ftypmp42'), 'video/mp4'), true);
});

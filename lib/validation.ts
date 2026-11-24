import { z } from 'zod';
import { blockers, statuses } from './rules';

const optionalText = (max: number) => z.string().trim().max(max);
export const safeLink = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return /^https:\/\//i.test(value) && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Enter an HTTPS link without credentials in the URL.').transform(value => value.replace(/^https:\/\//i, 'https://'));

export const MAX_ACCESS_ITEMS = 10;
const accessItem = z.strictObject({
  label: optionalText(100),
  email: z.union([z.email().max(254), z.literal('')], { error: 'Enter a valid account email.' }).default(''),
  password: z.string().max(512).default(''),
  url: safeLink.default(''),
  note: optionalText(2000).default(''),
});
export type TaskAccessItem = z.infer<typeof accessItem>;

const hasAccessDetails = (item: TaskAccessItem) => Object.values(item).some(Boolean);
const accessItems = z.array(accessItem, { error: 'Enter a list of access items.' })
  .max(MAX_ACCESS_ITEMS, `Add up to ${MAX_ACCESS_ITEMS} access items.`)
  .superRefine((items, context) => {
    items.forEach((item, index) => {
      if (hasAccessDetails(item) && !item.label) {
        context.addIssue({ code: 'custom', path: [index, 'label'], message: 'Enter a label for this access item.' });
      }
    });
  })
  .transform(items => items.filter(hasAccessDetails));

export const newTask = z.object({
  projectId: z.uuid({ error: 'Select a project.' }), requestId: z.uuid(),
  title: z.string().trim().min(3, 'Enter a task title of at least 3 characters.').max(120),
  instructions: z.string().trim().min(1, 'Enter instructions for the task.').max(5000),
  dueAt: z.iso.datetime({ error: 'Choose a valid completion date and time.' }),
  checklist: z.array(z.string().trim().min(1).max(160)).max(12),
  caption: optionalText(2200), referenceUrl: safeLink,
  accessLabel: optionalText(100), accessUrl: safeLink, accessItems: accessItems.default([]),
}).strict().refine((input) => !!input.accessLabel === !!input.accessUrl, {
  message: 'Provide both an access label and its link.', path: ['accessUrl'],
});

export function parseNewTaskForm(form: FormData) {
  const read = (name: string) => String(form.get(name) ?? '');
  let items: unknown = form.get('accessItems') ?? [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { /* Zod rejects invalid JSON as a non-array value. */ }
  }
  return newTask.safeParse({
    projectId: read('projectId'),
    requestId: read('requestId'),
    title: read('title'),
    instructions: read('instructions'),
    dueAt: read('dueAt'),
    checklist: read('checklist').split('\n').map(line => line.trim()).filter(Boolean),
    caption: read('caption'),
    referenceUrl: read('referenceUrl'),
    accessLabel: read('accessLabel'),
    accessUrl: read('accessUrl'),
    accessItems: items,
  });
}

export const taskUpdate = z.object({
  taskId: z.uuid(), status: z.enum(statuses), blocker: z.enum(blockers), note: optionalText(1000),
}).strict().refine(({ status, blocker, note }) =>
  (status === 'blocked' && blocker !== 'none' && !!note) ||
  (status !== 'blocked' && blocker === 'none' && !note),
{ message: 'A blocked task needs an owner and a note. Clear both when unblocking.', path: ['blocker'] });

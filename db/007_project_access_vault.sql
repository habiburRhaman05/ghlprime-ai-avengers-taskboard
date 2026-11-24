BEGIN;

LOCK TABLE portal.tasks, portal.task_resources IN ACCESS EXCLUSIVE MODE;

CREATE TABLE portal.project_access_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES portal.projects ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES portal.users,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 100),
  url text CHECK (url IS NULL OR (char_length(url) BETWEEN 1 AND 1000 AND url ~* '^https://')),
  account_email text CHECK (account_email IS NULL OR char_length(account_email) <= 254),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  encrypted_password text CHECK (encrypted_password IS NULL OR char_length(encrypted_password) <= 4096),
  -- Imported passwords were authenticated with the old task ID as context.
  -- This ID is retained even if the original task is deleted.
  legacy_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX project_access_items_project_time ON portal.project_access_items (project_id, created_at, id);
REVOKE ALL ON portal.project_access_items FROM PUBLIC;

INSERT INTO portal.project_access_items
  (id, project_id, created_by, label, url, account_email, note, encrypted_password, legacy_task_id, created_at)
SELECT r.id, t.project_id, r.created_by, r.label, r.url, r.account_email, r.note, r.encrypted_password, t.id, r.created_at
FROM portal.task_resources r JOIN portal.tasks t ON t.id = r.task_id
WHERE r.kind = 'access';

INSERT INTO portal.project_access_items (project_id, created_by, label, url, legacy_task_id, created_at)
SELECT project_id, created_by, access_label, access_url, id, created_at
FROM portal.tasks WHERE access_label IS NOT NULL;

DELETE FROM portal.task_resources WHERE kind = 'access';
UPDATE portal.tasks SET access_label = NULL, access_url = NULL WHERE access_label IS NOT NULL;

ALTER TABLE portal.task_resources ADD CONSTRAINT task_resources_media_only CHECK (kind = 'media_link');
ALTER TABLE portal.tasks ADD CONSTRAINT tasks_access_in_project_vault CHECK (access_label IS NULL AND access_url IS NULL);

COMMIT;

BEGIN;
CREATE TABLE portal.task_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES portal.tasks ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES portal.users,
  kind text NOT NULL CHECK (kind IN ('access', 'media_link')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 100),
  url text CHECK (url IS NULL OR (char_length(url) BETWEEN 1 AND 1000 AND url ~ '^https://')),
  account_email text CHECK (account_email IS NULL OR char_length(account_email) <= 254),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  encrypted_password text CHECK (encrypted_password IS NULL OR char_length(encrypted_password) <= 4096),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (kind = 'access' OR (url IS NOT NULL AND account_email IS NULL AND encrypted_password IS NULL))
);
CREATE INDEX task_resources_task_id ON portal.task_resources (task_id, created_at);
REVOKE ALL ON portal.task_resources FROM PUBLIC;
COMMIT;

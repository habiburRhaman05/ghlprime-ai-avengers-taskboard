BEGIN;
CREATE SCHEMA portal;

CREATE TYPE portal.role AS ENUM ('super_admin', 'agency_member', 'client_admin');
CREATE TYPE portal.status AS ENUM ('assigned', 'in_progress', 'blocked', 'ready_for_review', 'completed');
CREATE TYPE portal.blocker AS ENUM ('none', 'client', 'agency', 'external');
CREATE SEQUENCE portal.task_numbers;

CREATE TABLE portal.users (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  role portal.role NOT NULL
);
CREATE UNIQUE INDEX one_super_admin ON portal.users (role) WHERE role = 'super_admin';
CREATE UNIQUE INDEX one_agency_member ON portal.users (role) WHERE role = 'agency_member';

CREATE TABLE portal.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE TABLE portal.memberships (
  project_id uuid REFERENCES portal.projects ON DELETE CASCADE,
  user_id uuid REFERENCES portal.users ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE portal.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint UNIQUE NOT NULL DEFAULT nextval('portal.task_numbers'),
  project_id uuid NOT NULL REFERENCES portal.projects,
  created_by uuid NOT NULL REFERENCES portal.users,
  request_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  instructions text NOT NULL CHECK (char_length(btrim(instructions)) BETWEEN 1 AND 5000),
  checklist jsonb NOT NULL DEFAULT '[]',
  caption text CHECK (char_length(caption) <= 2200),
  reference_url text,
  access_label text,
  access_url text,
  assignee text NOT NULL DEFAULT 'GHL Prime Team' CHECK (assignee = 'GHL Prime Team'),
  status portal.status NOT NULL DEFAULT 'assigned',
  blocker portal.blocker NOT NULL DEFAULT 'none',
  blocker_note text NOT NULL DEFAULT '' CHECK (char_length(blocker_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  due_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (created_by, request_id),
  CHECK (isfinite(created_at) AND isfinite(due_at) AND due_at >= created_at + interval '24 hours'),
  CHECK ((blocker = 'none' AND blocker_note = '' AND status <> 'blocked') OR
         (blocker <> 'none' AND char_length(btrim(blocker_note)) > 0 AND status = 'blocked')),
  CHECK ((access_label IS NULL) = (access_url IS NULL))
);
CREATE INDEX tasks_project_due ON portal.tasks (project_id, due_at, number);
CREATE TABLE portal.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES portal.tasks ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES portal.users,
  kind text NOT NULL CHECK (kind IN ('update', 'learning')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2500),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX comments_task_time ON portal.comments (task_id, created_at);
CREATE TABLE portal.media (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES portal.tasks ON DELETE CASCADE,
  uploader uuid NOT NULL REFERENCES portal.users,
  object_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','video/mp4','video/webm')),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 52428800),
  ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX media_task ON portal.media (task_id);
CREATE TABLE portal.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES portal.tasks ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES portal.users,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX events_task_time ON portal.events (task_id, id);

INSERT INTO portal.projects (name, slug) VALUES
  ('AI Avengers', 'ai-avengers'),
  ('Shading Director', 'shading-director'),
  ('Insurance Defender', 'insurance-defender');
REVOKE ALL ON SCHEMA portal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA portal FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA portal FROM PUBLIC;
COMMIT;

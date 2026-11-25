BEGIN;

ALTER TABLE portal.tasks
  DROP CONSTRAINT tasks_project_id_fkey,
  ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES portal.projects ON DELETE CASCADE,
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES portal.users ON DELETE SET NULL;

ALTER TABLE portal.comments
  ALTER COLUMN author_id DROP NOT NULL,
  DROP CONSTRAINT comments_author_id_fkey,
  ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES portal.users ON DELETE SET NULL;

ALTER TABLE portal.media
  ALTER COLUMN uploader DROP NOT NULL,
  DROP CONSTRAINT media_uploader_fkey,
  ADD CONSTRAINT media_uploader_fkey FOREIGN KEY (uploader) REFERENCES portal.users ON DELETE SET NULL;

ALTER TABLE portal.events
  ALTER COLUMN actor_id DROP NOT NULL,
  DROP CONSTRAINT events_actor_id_fkey,
  ADD CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES portal.users ON DELETE SET NULL;

ALTER TABLE portal.task_resources
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT task_resources_created_by_fkey,
  ADD CONSTRAINT task_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES portal.users ON DELETE SET NULL;

ALTER TABLE portal.project_access_items
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT project_access_items_created_by_fkey,
  ADD CONSTRAINT project_access_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES portal.users ON DELETE SET NULL;

CREATE TABLE portal.media_deletions (object_key text PRIMARY KEY);
REVOKE ALL ON portal.media_deletions FROM PUBLIC;

CREATE FUNCTION portal.queue_media_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO portal.media_deletions (object_key) VALUES (OLD.object_key) ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;
CREATE TRIGGER queue_media_deletion AFTER DELETE ON portal.media
  FOR EACH ROW EXECUTE FUNCTION portal.queue_media_deletion();

COMMIT;

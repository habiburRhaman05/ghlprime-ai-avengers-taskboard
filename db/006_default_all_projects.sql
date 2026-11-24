BEGIN;
ALTER TABLE portal.users ADD COLUMN all_projects boolean NOT NULL DEFAULT false;
ALTER TABLE portal.users ADD CONSTRAINT all_projects_only_for_clients CHECK (NOT all_projects OR role = 'client_admin');

-- Memberships remain the authorization boundary. This flag grants memberships
-- for existing and future projects, without undoing individual revocations.
CREATE FUNCTION portal.grant_default_projects_to_client() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'client_admin' AND NEW.all_projects THEN
    PERFORM pg_advisory_xact_lock(724319502);
    INSERT INTO portal.memberships (project_id,user_id)
      SELECT id, NEW.id FROM portal.projects ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER grant_default_projects_on_client_insert
  AFTER INSERT ON portal.users FOR EACH ROW EXECUTE FUNCTION portal.grant_default_projects_to_client();
CREATE TRIGGER grant_default_projects_on_client_enable
  AFTER UPDATE OF all_projects ON portal.users FOR EACH ROW
  WHEN (NEW.all_projects AND NOT OLD.all_projects) EXECUTE FUNCTION portal.grant_default_projects_to_client();

CREATE FUNCTION portal.grant_new_project_to_clients() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(724319502);
  INSERT INTO portal.memberships (project_id,user_id)
    SELECT NEW.id, id FROM portal.users WHERE role='client_admin' AND all_projects ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER grant_new_project_to_clients
  AFTER INSERT ON portal.projects FOR EACH ROW EXECUTE FUNCTION portal.grant_new_project_to_clients();
COMMIT;

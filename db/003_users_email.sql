BEGIN;

ALTER TABLE portal.users
ADD COLUMN email text NOT NULL UNIQUE CHECK (char_length(btrim(email)) BETWEEN 5 AND 254),
ADD COLUMN password_hash text NOT NULL CHECK (char_length(password_hash) BETWEEN 60 AND 255);

COMMIT;
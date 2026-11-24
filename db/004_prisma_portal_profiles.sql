BEGIN;
-- Match portal profiles to the existing Prisma identities by their unique email.
-- Do not overwrite roles or credentials on an existing portal profile.
INSERT INTO portal.users (id, name, role, email, password_hash)
SELECT gen_random_uuid(), u.name, u.role::text::portal.role, u.email, u.password_hash
FROM public."User" u
WHERE NOT EXISTS (SELECT 1 FROM portal.users p WHERE lower(p.email) = lower(u.email));
COMMIT;

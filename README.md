# GHL Prime Client Portal

> **Current implementation:** Sign-in uses Prisma's `User` table and the configured PostgreSQL database. The app uses the `portal` schema for projects and tasks, and local private storage for media. The original Supabase provisioning steps below describe the planned architecture and do not configure this implementation. Do not deploy local filesystem storage to an ephemeral or multi-instance host without replacing it with shared private storage.

For the current database, apply `db/001_portal.sql`, `db/003_users_email.sql`, `db/004_prisma_portal_profiles.sql`, `db/005_task_resources.sql`, `db/006_default_all_projects.sql`, `db/007_project_access_vault.sql`, and `db/008_admin_deletion.sql` in order. Migration 003 adds required columns and applies cleanly to an empty `portal.users` table. Backfill and reconcile existing portal identities first when needed. Migration 004 creates matching Prisma portal profiles. Reconcile matching emails and the single superadmin and agency-member slots before running it against an existing database. Migration 006 preserves membership scopes and supports default memberships for all current and future projects.

Set `DATABASE_URL`, `SESSION_SECRET`, `STORAGE_SIGNING_SECRET`, `STORAGE_DIR`, `TASK_CREDENTIALS_KEY`, and `APP_URL` on the server. Keep `TASK_CREDENTIALS_KEY` as a backed-up, secret 32-byte hexadecimal key shared by all app instances. Losing or changing it without migrating encrypted credentials makes saved passwords unavailable. Set `APP_URL` to the exact app origin. Sign-in requires a matching portal profile with the same email and role, and client accounts require explicit project memberships.

Next.js source and implementation docs for the AI Avengers, Shading Director, and Insurance Defender client projects.

| Document | Purpose |
|---|---|
| [PRD](docs/PRD.md) | Product scope, roles and acceptance criteria |
| [TRD](docs/TRD.md) | Architecture, data, validation and access control |
| [UI Specification](docs/UI-SPEC.md) | Screens, field rules and workflow interactions |
| [Build Sprint](docs/BUILD-SPRINT.md) | Six implementation and test phases |
| [Agent instructions](AGENTS.md) | Working rules for future coding agents |

## Run locally

Use Node.js 24. Install dependencies with `npm ci` using the supplied lockfile. Copy `.env.example` to `.env.local` and fill it using a staging Supabase project.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Server-only TLS Postgres DSN. Use a Supabase pooler endpoint on hosts where required, with a dedicated runtime role. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon/publishable key |
| `SUPABASE_SECRET_KEY` | Server-only Storage admin key |
| `APP_URL` | Canonical origin such as `http://localhost:3000` or the production HTTPS URL. Set correctly in each environment. |

Run `npm run dev`, then visit `http://localhost:3000`.

## Provision and deploy

Use `npm run build` on Vercel. This generates Prisma Client from `prisma/schema.prisma` before Next.js loads the server routes.

For an existing database on migration 006, apply migration 007 once before serving the release that uses the project vault. The transaction moves both kinds of task access entries into their original projects, preserves ciphertext, and retires task-level access writes. Keep the current `TASK_CREDENTIALS_KEY` when deploying. Give the app's runtime DB role SELECT, INSERT, and DELETE for `portal.project_access_items` if it connects through a separate role. Verify project vault access and task media after rollout.

Apply migration 008 once before serving the release with Super Admin deletion. The migration updates foreign keys and creates the private attachment deletion queue. If the runtime connects through a separate role, grant DELETE on `portal.projects`, `portal.tasks`, `portal.users`, and `public."User"` and SELECT, INSERT, and DELETE on `portal.media_deletions`. Grant UPDATE on `portal.projects.id` so task creation can lock the project while inserting the task. Check task, project, and member deletion against synthetic records. Failed attachment cleanup stays in `portal.media_deletions` and is retried on the next deletion.

1. Create separate staging and production Supabase projects. Apply `db/001_portal.sql` then `db/002_storage.sql` once per database with a migration operator. Keep the portal schema outside the exposed Data API list. Ensure the private bucket supports the 50 MiB maximum.
2. Provision a dedicated DB login with TLS, `USAGE` on portal and auth schemas, and limited privileges needed for the portal tables and sequences. The application reads only `id`, `email`, and `created_at` from `auth.users`. It writes portal accounts, memberships, projects, tasks, comments, media, and events as permitted by the app. It needs UPDATE for task and media operations and DELETE for membership revocation and failed media reservations. Give runtime access to data without schema modification privileges.
3. Configure the site URL, production SMTP, and provider invite restrictions. Set the invite email link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. If using password reset emails, use the same route with `type=recovery`. Turn off public sign-up. In production verify the email link against the correct origin before onboarding.
4. Create the Super Admin identity in Supabase Auth and run this SQL once with the verified user's real UUID, using your migration operator:

   ```sql
   INSERT INTO portal.users (id, name, role)
   SELECT id, 'Platform Admin', 'super_admin'
   FROM auth.users
   WHERE id = '<super-admin-uuid>'::uuid;
   ```

   Invite the other four users through Supabase Auth, then pregrant each profile through **Settings → Grant access** before the invite recipient opens the portal. Give each client only their assigned project. Use Agency member and No single project for the internal team user. The account recipient sets a password after their invite link opens Settings.
5. Run `npm test`, `npm run test:db`, `npm run typecheck`, and `npm run build`. Deploy the Next.js repo to the connected staging host. Set the listed variables per environment, marking the database DSN and storage secret sensitive. Run the six-phase acceptance checks before using the production environment.
6. Repeat provisioning and smoke tests in production, then give each client its login link. Record the release commit, deployment URL, migration version, and smoke-test outcome.

## Operations

Keep preview and production data separate. Rotate compromised links or keys at their provider. Use a new forward migration for schema changes. For a bad app release, roll the deployment back to the last build compatible with the current schema and recheck sign-in and task access. Review pending media older than two hours and remove abandoned objects via the Storage API before removing their pending rows. Restoring a full database requires owner review of data added after the restore point.

## Verification status

Core tests, the isolated database migration suite, TypeScript checking, and the optimized Next.js build passed locally. The HTTP smoke suite passed against the local optimized server. It checks login rendering, protected route redirects, cache policy, and anonymous media denial. Run it with `PORTAL_SMOKE_URL=http://127.0.0.1:3000 npm run test:smoke` while the server is up. Browser acceptance, invite delivery, private storage, and production deployment require a configured target environment.

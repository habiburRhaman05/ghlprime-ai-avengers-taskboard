# GHL Prime Client Portal · Technical Requirements

## Current implementation note

Migration 006 records whether a client admin should automatically receive future projects. Database triggers grant explicit membership rows for current projects when this option is enabled and for future projects as they are created. Project authorization still depends on each membership. Revoking a membership remains effective for that project; stopping automatic access to future projects does not remove existing memberships. The migration does not broaden existing accounts.

Migration 007 moves task access entries and legacy task access links to `portal.project_access_items`, using the task's project ID. It preserves prior access item IDs, metadata, and ciphertext. Labeled media links remain in `portal.task_resources`. New tasks store briefs, media and reference links. The project owns the vault entries even if the original task is deleted.

The vault accepts a validated array of up to ten access items per submission and saves them atomically. Optional passwords use AES-256-GCM with a random nonce and the project and item IDs as authenticated context. Migrated passwords retain the original task ID as their context. `TASK_CREDENTIALS_KEY` is a server-only 32-byte hexadecimal key. Keep the same key across app instances and migrations. Re-encrypt existing entries before retiring a key. A no-store endpoint rechecks project access before revealing a password. URLs are restricted HTTPS references without embedded credentials.

Agency members may read project content, post updates, and make permitted workflow changes, but may not create tasks or add attachments. Enforce these restrictions at the server actions and media endpoints as well as in the interface. Approval and reopening remain administrator-only.

The configured application currently authenticates against Prisma's `public."User"` table, rather than the Supabase Auth integration described in the original specification below. Project, task, and membership records remain in the `portal` schema. Migration `004_prisma_portal_profiles.sql` creates portal profiles for existing Prisma accounts by email; protected requests require a matching email and role in both tables and use the portal UUID for project authorization. Provisioning an account requires both records. A client still requires an explicit project membership. Local private file storage is currently used, so shared or ephemeral production hosts require an appropriate shared private storage solution before deployment.

## Stack

| Layer | Selection |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript, Node.js 24 |
| UI | Server-rendered pages, React client forms, responsive CSS |
| Validation | Zod schemas, browser form constraints, Postgres invariants |
| Identity | Supabase Auth, invite-only after provider configuration, email/password and SSR cookies |
| Data | Supabase Postgres via node-postgres and parameterized SQL in a private schema |
| Files | Supabase Storage private bucket, direct signed uploads, server-issued signed downloads |
| Verification | Node test runner, isolated PGlite database check, five-account staging acceptance |
| Host | Vercel or an equivalent Next.js Node.js deployment. Separate staging and production environments. |

Supabase is selected as the integrated option for Postgres, authentication, and media. A Neon database URL alone supplies only Postgres. Choosing Neon for this design would require external identity/storage and an alternative to the current `auth.users` lookup in Settings.

## Routes and operations

| Surface | Operations |
|---|---|
| `/login`, `/auth/confirm` | Password sign-in, invite and recovery token exchange |
| `/dashboard` | Scoped project selector, task list, status filter, pagination |
| `/projects/[slug]` | Scoped board and access vault. Super Admin and project Client Admin can add or remove vault entries. |
| `/tasks/new` | Project authorization, strict task validation, atomic insert and retry key |
| `/tasks/[id]` | Read task, post comment, update status and blocker, show recent activity |
| `/settings` | Account password update. Super Admin can create projects and grant or revoke client access. |
| `POST /api/media` | `begin` returns a private signed upload reservation. `finish` verifies the file and publishes it in the task. |
| `GET /api/media/[id]` | Recheck project access for ready media; issue a 60-second signed download. |
| `GET /api/project-access/[id]/password` | Recheck access to the owning project and reveal the encrypted password through a private, no-store response. |

Mutations are protected at their server entry points. The media POST rejects a mismatched request origin. Server actions use the framework's origin check and independent session and project checks. Missing tasks, wrong-project tasks, and inaccessible files return 404 or a generic unavailable result. Invalid metadata returns 400. Invalid format/size after upload returns 422. Conflicting uploads return 409. A storage interruption returns 502.

## Model and sequencing

| Record | Ownership or key |
|---|---|
| `users` | Supabase Auth UUID, display name and portal role. Database limits the agency and super-admin slots to one each. |
| `projects` | UUID and unique slug. Seed creates the three launch projects. |
| `memberships` | Unique pair of project and client admin IDs. |
| `tasks` | Project FK, author FK, global sequence, fixed team assignee, request UUID, brief, UTC deadline, status and blocker. |
| `project_access_items` | Project and author IDs, platform label, optional account email, encrypted password, restricted link, and note. |
| `comments` | Task and author IDs, update or learning, body and timestamp. |
| `media` | Task ID, verified uploader, private object key, type, size, and readiness flag. |
| `events` | Task ID and actor, old/new status, blocker category and time. Workflow changes and events commit together. |

Task numbers come from a database sequence and are formatted as `TASK-001`. Retries on the same creator and request UUID return the original task for that project. Sequences may skip numbers on failed or concurrent inserts. Status transitions lock the task row to evaluate the latest state. Access scopes are evaluated server-side on subsequent requests after a membership is revoked.

## Deadline contract

Store both values as `timestamptz`. The submitted timestamp is ISO 8601 UTC. The browser compares elapsed time to give immediate feedback. The server compares the received deadline to its clock. The insert compares to Postgres `statement_timestamp()` and the database constraint independently compares to `created_at + interval '24 hours'`. This is an inclusive lower bound with no end-of-day rounding. A timezone or daylight-saving change never redefines the 24-hour duration. The currently available UI has minute granularity, so the next available minute may be slightly beyond the exact boundary.

## Access and data rules

- Portal schema stays outside Supabase's exposed Data API schemas. Anonymous/public SQL access is revoked. Supabase account verification and an active portal profile are checked on each protected request.
- Use TLS, server-held database and storage keys, and a database runtime user with narrowly scoped grants. Client-rendered code receives only the public Supabase values.
- Private media uses random object keys and signed upload reservations. Object limits are 10 files per task including active reservations and up to 50 MiB per file. Validate declared MIME and size in the app, bucket policy, and finalization metadata. Validate header signatures for PNG, JPEG, WebP, MP4, and WebM. The download endpoint issues attachment downloads. Signature verification is not a full file decode or malware scanner.
- Send newly issued download URLs only after a fresh authorization check. A previously issued URL can remain usable until its short expiration. Review and purge abandoned upload reservations and their storage objects as part of operations.
- Access URLs are bounded HTTPS references without a user/password component. A restricted invite or vault link must enforce its own recipient access. Passwords belong only in the encrypted password field, not in captions, notes, labels, or links.
- Keep task, link, and media bodies out of application logs and build artifacts. Do not reuse live customer data in staging.

## Official references

- Next.js authentication and authorization guide. https://nextjs.org/docs/app/guides/authentication
- Next.js deployment guide. https://nextjs.org/docs/app/getting-started/deploying
- Supabase server-side authentication. https://supabase.com/docs/guides/auth/server-side
- Supabase signed uploads. https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- Supabase private signed downloads. https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl
- Vercel sensitive environment variables. https://vercel.com/docs/environment-variables/sensitive-environment-variables

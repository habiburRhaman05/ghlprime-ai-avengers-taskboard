# GHL Prime Client Portal · Build Sprint

Sequence has six phases. Production rollout depends on the gates in phase 6. Keep acceptance evidence in the team's release records.

| Phase | Implementation | Tests and exit gate |
|---|---|---|
| 1. Foundation | Next.js shell, environment contract, Postgres schema, project seeds, CI commands | Install and lock dependencies, typecheck, production build, clean DB migration, expected project seed count and mobile shell review. |
| 2. Auth and project isolation | Verified session, platform role, client memberships, agency queue, settings | Use all five accounts in staging. Test invalid/expired login, own project access, cross-project task and attachment denial, revoked membership and direct action requests. |
| 3. Task creation and deadlines | Fixed team assignment, task numbers, instructions, checklist, caption, access fields | Compare 1h, 2h, 23h, 24h minus 1ms, exactly 24h and later dates. Test daylight-saving transitions, international timezone, server-bypassed HTML validation, malformed URLs, retries and concurrent display IDs. |
| 4. Workflow and collaboration | Status, blocker ownership, comments and learnings, ready-for-review and approval | Test valid and disallowed transitions for each role, blocked note requirement, stale concurrent submissions, reopen flow, comments and safe plain-text rendering. |
| 5. Media and UI QA | Private image/video uploads, signed downloads, local timestamps, responsive error states | Verify PNG and MP4, mismatched type, zero size, oversize, duplicate reservation, expired token, failed retry, inaccessible file, keyboard and mobile layout. |
| 6. Staging and release | Provision accounts, configure private bucket and SMTP, deploy on Node.js host, complete launch smoke test | Perform full five-account end-to-end run, confirm production environment integrity, verify logs and safe rollbacks, publish and retain the live URL only after checks pass. |

## Acceptance run

1. Super Admin signs in, checks the three seeded projects, and grants project membership for the staging client accounts.
2. Each client opens only its own dashboard, creates a task with GHL Prime Team fixed, and receives a unique number.
3. The AI Avengers client tests early deadlines, submits a valid task, adds a caption, uploads an image and a video, and attaches a restricted access link.
4. The agency member sees the task, sets and clears a client blocker, adds a learning, and sends the task for review.
5. Its client approves. A different client attempts the direct task and media URLs and receives generic unavailable results. Check expiry of any already-issued media URL separately.
6. Revoke a staging membership and repeat reads and updates with the prior session. Regrant only after the denial is verified.
7. Record account role, browser/device, expected and actual outcome, and evidence without secrets or real customer files.

## Current verification

- `npm test` covers exact deadline boundaries, a daylight-saving case, approval permissions, task display IDs, and signature checks.
- `npm run test:db` checks the schema once dependencies are installed.
- Hosted authentication, private file uploads, browser layout and multi-account isolation require a configured staging environment. Mark the corresponding release gates passed only after executing them.

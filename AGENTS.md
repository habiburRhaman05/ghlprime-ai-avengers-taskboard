# GHL Prime Client Portal

Read `docs/PRD.md`, `docs/TRD.md`, `docs/UI-SPEC.md`, and `docs/BUILD-SPRINT.md` before extending the app. Use the verification commands and rollout runbook in `README.md`.

- Preserve the inclusive minimum completion deadline of 24 elapsed hours from task creation. Use UTC timestamps and server/database enforcement. A reply timer is outside this contract.
- Treat every client project as a membership boundary. Authorize each server action, page, file reservation, and signed download.
- Keep GHL Prime Team as the task assignee. Keep email/password authentication in Supabase and protected values server-side.
- Update the migration and contract together when a persisted invariant changes. Write forward migrations for already deployed data.
- Keep files private. Recheck project access before issuing new download URLs. Store only invitation or restricted vault link references.
- Use synthetic records in tests. Preserve deadline, boundary, workflow and media regression tests. Report actual build and deployment results with a command or staging check.

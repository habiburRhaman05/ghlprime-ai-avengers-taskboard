# GHL Prime Client Portal · UI Specification

## Visual system

Use DM Sans, shared shadcn/ui form controls, white panels, and violet primary actions. The sign-in form sits in a centered card and includes a password visibility toggle. Navigation stays in the header and wraps below the logo and account controls on phones. Task panels stack on narrower screens, and the board stacks its status columns on phones. Status always includes a text label. Show accessible loading skeletons and toast feedback alongside inline errors.

## Screen map

| Screen | Content and actions | Key states |
|---|---|---|
| Login | Portal name, email, password, Sign in | Invalid credentials, expired account link, awaiting project access |
| Dashboard | Project cards with open and completed task counts, workspace totals, New task for admins | Scoped projects, no project access, tasks due within 24 hours |
| Project board | Clickable task cards grouped by status, status filter, and pagination | Empty board, empty filter results, due soon, overdue |
| Create task | Full width with task details on the left, content and access on the right, and Create task at bottom right. Panels stack on smaller screens. | Invalid deadline, invalid access item, submit in progress, retained inputs after validation error |
| Task detail | Task ID, project, status, deadline, instructions, checklist, media, comments, access, activity | Blocker note, ready for review, overdue, upload pending or failed |
| Settings | Account, password, project list | Super Admin additionally sees project creation, account grant form and client memberships |

Creating or granting access to a client defaults to all current and future projects, with a single-project option. The administrator can remove individual memberships and can stop automatic access to future projects without removing current memberships.

## Create task inputs

| Label | Entry and limits | Required |
|---|---|---|
| Project | Lock to the current project when creating from a project page; otherwise select from accessible projects. The server binds and reauthorizes the current project. | Yes |
| Assigned to | Read-only value GHL Prime Team. Server fixes the same value. | Automatic |
| Task title | Trimmed plain text, 3–120 characters | Yes |
| Instructions | Trimmed multiline plain text, 1–5,000 characters | Yes |
| Completion deadline | Use the shadcn/ui calendar and time input in the viewer’s timezone. Convert to UTC. Minimum is 24 elapsed hours after creation. | Yes |
| Checklist | One step per line, up to 12 steps, 160 characters per step | No |
| Social media caption | Plain text, up to 2,200 characters | No |
| Reference link | HTTPS URL, up to 1,000 characters, no URL credentials | No |
| Access items | Add up to 10 while creating the task. Each entry has a platform label and optional account email, password, restricted HTTPS link, and instructions or note. Saved entries appear in the task’s Access section. | No |
| Media links | On the task: label, HTTPS URL, and optional note. Multiple links allowed. | No |
| Image or video | In the created task's Media section. PNG, JPEG, WebP, MP4 or WebM; 50 MiB each; 10 per task. | No |

Show the hint “Choose a time at least 24 hours after creating the task” beside the deadline. The form rejects a deadline earlier than the lower bound without clearing the brief. Browser formatting follows the device timezone.

## Workflow controls

| Current status | Available updates |
|---|---|
| Assigned | In progress, Blocked |
| In progress | Blocked, Ready for review |
| Blocked | In progress, or update the blocker note and owner |
| Ready for review | In progress, Blocked, Completed for admins |
| Completed | Reopen to In progress for admins |

When Blocked is selected, display **Who needs to act?** and **What is needed?**. Select client, GHL Prime Team, or third party and add a note up to 1,000 characters. Under **Updates and learnings**, select Progress update or Learning and enter up to 2,500 characters. Show current blocker ownership in task status.

## Interaction and accessibility checks

- Check tab order from the top navigation through filters and into the task content, including the calendar and file input.
- Check programmatic labels, accessible submit states, visible focus, and text announcements for errors.
- Check safe wrapping of long names, file names, and instructions. Keep the primary action visible on a 360 px viewport.
- Check that an unauthorized project has no visible tile, and that its direct route shows the same generic unavailable screen as an unknown task.

# GHL Prime Client Portal · Product Requirements

**Audience** · Agency owner, three client administrators, and one agency member  
**Language** · English  
**Initial projects** · AI Avengers, Shading Director, Insurance Defender

## Purpose

Give each client a project workspace for assigning work to GHL Prime Team. Keep the brief, completion deadline, caption, files, access links, blocker ownership, and conversation together on the task.

## Roles and access

| Capability | Super Admin | Client Admin | Agency Member |
|---|---|---|---|
| View projects and tasks | All projects | Projects explicitly granted to this account | All GHL Prime projects |
| Create projects and manage client access | Yes |  |  |
| Create tasks assigned to GHL Prime Team | Yes | In own projects |  |
| Post progress, learnings, and blocker updates | Yes | In own projects | Yes |
| Add task content and media | Yes | In own projects | No |
| Approve or reopen completed work | Yes | In own projects |  |
| Update own password | Yes | Yes | Yes |

Initial rollout has one client admin per project, one super admin, and one internal agency member. A client admin receives dashboard access through a verified account and an explicit project membership. The three customer accounts are provisioned after their verified emails are supplied. Assignment displays **GHL Prime Team** on every task. The single agency member works from that shared queue.

New client admins default to all current and future projects when a Super Admin creates them; a single project can be selected instead. All-project access is materialized as individual project memberships, and an administrator can revoke individual memberships or stop automatic access to future projects. Existing client accounts retain their previous scope unless explicitly changed.

## Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| P01 | Sign-in and project isolation | AI Avengers, Shading Director, and Insurance Defender each have their own dashboard scope. Opening a different project's task, comment action, or attachment directly returns an unavailable result. |
| P02 | Platform administration | Super Admin can create projects, grant client membership, and revoke membership. The agency role has one slot. |
| P03 | Task creation | A task requires a project, title, instructions, and completion deadline. It gets a globally unique display ID such as `TASK-001` and assigns GHL Prime Team automatically. Consecutive IDs can have gaps. |
| P04 | Minimum completion deadline | `deadline ≥ creation timestamp + 24 elapsed hours`. Reject 1 hour, 2 hours, 23 hours, and one millisecond under 24 hours. Accept the exact boundary and later valid times. Convert browser entry to an instant and enforce with server and database clocks. There is one completion deadline and no reply timer. |
| P05 | Content and access | Add an optional checklist, social caption, reference URL, multiple platform access items and labeled media URLs. Platform items may include an email, instructions and a password encrypted server-side. Attach images and videos within the created task. |
| P06 | Status and blocker selection | Task starts Assigned. Blocked requires a selected owner and a note. Owners are the client, GHL Prime Team, or a third party. An unblocked task clears both values. |
| P07 | Collaboration and approval | Client and agency can post progress updates and learnings. The agency submits work for review. Client Admin or Super Admin can approve; an admin can reopen completed work. Show author and time on comments and recent workflow activity. |
| P08 | Deadlines and overdue work | Display the deadline in the viewer's timezone. Dashboard flags open tasks due within 24 hours. Dashboard and task detail show Overdue after the deadline. |
| P09 | Responsive UI and feedback | Provide login, dashboard, create task, task details, and settings on mobile and desktop. Show validation errors, empty states, progress, and permission failures. |

## Example client journey

The AI Avengers client admin signs in and opens their project. At **23 November 2026, 8:00 PM Dhaka time**, they create “Draft the December campaign post.” The earliest eligible completion deadline is **24 November 2026, 8:00 PM Dhaka time**. They attach a product image in the created task. GHL Prime Team starts work, marks the task **Blocked · Waiting on the client** with a request for logo approval, and resumes once the client replies. The agency shares the draft, moves the task to **Ready for review**, and the client approves it.

## Release scope

In-app dashboard is the working queue, with due-soon and overdue indicators. Reminders by email, Slack, or SMS, direct GHL API integration, deadline editing, and client self-signup are outside the first build. Passwords in access items are encrypted at rest and revealed only to authorized project users.

## Release acceptance

All five roles-as-accounts (three clients, one agency member, one Super Admin) complete the assigned parts of the journey on staging. Each client sees only granted projects. A signed-in user cannot access another project's files or tasks, and the 24-hour floor holds on direct server requests.

# Project Management

Version: 2.0 · Date: 2026-09-13

Lightweight projects and tasks for businesses that manage engagements — clinics,
agencies, service providers. MVP-built module.

---

## 1. Entities

```
projects  id, business_id, name, description?, status, owner_id?, created_at
tasks     id, business_id, project_id, title, description?, status, priority,
          assignee_id?, due_date?, created_at, updated_at
```

## 2. Statuses

**Project:**
```
PLANNING → ACTIVE → ON_HOLD → COMPLETED
                            ↘ CANCELLED
(→ ARCHIVED from any terminal state)
```

**Task (kanban-friendly):**
```
TODO → IN_PROGRESS → IN_REVIEW → DONE
   ↘ BLOCKED (from any active state, returns to prior)
   ↘ CANCELLED
```

`priority`: `LOW | MEDIUM | HIGH | URGENT`.

## 3. Integrations

- **Team** — tasks are assigned to team members (`assignee_id` → membership).
- **Calendar** (when enabled) — task `due_date`s surface on the calendar.
- **AI agent** — "Log it for me" can create a task on confirmation
  (`pm.tasks.create`).

## 4. Events

Emits: `pm.task.assigned`, `pm.task.completed` (available for Notifications to
react to, e.g. notify the assignee).

## 5. Permissions

`pm.projects.view|create|update`, `pm.tasks.view|create|update|assign`.

## 6. Out of scope (MVP)

Dependencies/Gantt, time tracking, billing from tasks, recurring tasks,
automations. Kept intentionally simple; these are later enhancements driven by
demand.

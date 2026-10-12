---
name: Create task
description: Create a to-do with a title and optional description or urgent flag.
---

Create one to-do for the signed-in user.

Use the `create_task` tool, `POST /api/v1/tasks`, or the MCP task call named `create_task`.

Required: `title` (non-empty text).
Optional: `description` (text) and `urgent` (boolean, default false).

The new row is owned by the signed-in user, starts not done, and has no `done_at`.

Do not set categories, assignees, or a platform-agent column. Do not create tasks for anyone else.

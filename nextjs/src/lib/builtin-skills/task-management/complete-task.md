---
name: Complete task
description: Mark one owned to-do done. There is no reopen.
---

Mark one of the signed-in user's to-dos done.

Use the `complete_task` tool, `POST /api/v1/tasks/{id}` with `{ "action": "complete" }`, or the MCP task call named `complete_task`.

Required: `id` of a row the signed-in user owns.

This sets `done` to true and `done_at` to the current time. There is no reopen. If the id is missing or belongs to someone else, say it was not found.

Do not change the title, description, or urgent flag in this step.

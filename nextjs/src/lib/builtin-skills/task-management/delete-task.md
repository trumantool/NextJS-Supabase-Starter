---
name: Delete task
description: Delete one owned to-do by id.
---

Delete one to-do that belongs to the signed-in user.

Use the `delete_task` tool, `DELETE /api/v1/tasks/{id}`, or the MCP task call named `delete_task`.

Required: `id` of a row the signed-in user owns.

This removes that row. If the id is missing or belongs to someone else, say it was not found. Do not delete every task unless the user asked to delete each id.

Do not use categories, assignees, or a platform-agent column to choose the row.

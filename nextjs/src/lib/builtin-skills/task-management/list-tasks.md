---
name: List tasks
description: List the signed-in owner's to-do rows.
---

List tasks that belong to the signed-in user.

Use the `list_tasks` tool, `GET /api/v1/tasks`, or the MCP task call named `list_tasks`.

Each row has `id`, `title`, `urgent`, `description`, `done`, `done_at`, and `created_at`. The table is `todo_list`. Rows are limited to the signed-in owner.

Optional filter: `done` true or false. Omit it to return both open and finished tasks.

Do not list another person's tasks. Do not mention categories, assignees, or a platform-agent column. Those are not part of this list.

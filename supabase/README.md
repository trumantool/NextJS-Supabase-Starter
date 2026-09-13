# Supabase (Phase 1)

## Migrations (preferred)

This repo ships a real `supabase/migrations/` history starting at:

- [`migrations/20260913223000_slim_starter_baseline.sql`](./migrations/20260913223000_slim_starter_baseline.sql)
- [`migrations/20260913224500_byok_column_privileges.sql`](./migrations/20260913224500_byok_column_privileges.sql) — `openrouter_api_key` is service-role only

That baseline is the keep-only schema (documents, not resumes; no contact/assessment/Composio tables).

On a **new empty** Supabase project:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

`npx supabase migrations up --linked` also works once the project is linked.

## Consolidated view

[`schema.sql`](./schema.sql) is the same SQL as the baseline migration, kept as a single-file view for reading and optional SQL Editor apply on an empty project. Prefer migrations for forks. Do not re-run `schema.sql` on a project that already applied the migration.

## Storage buckets

| Bucket | Purpose |
|---|---|
| `user-files` | My Files UI. Object key is `{userId}/{sanitizedFileName}`. Folder markers from `handle_new_user` are hidden in the list. |
| `files` | Chat attachments (`{userId}/chat-attachments/{chatId}/…`) — unused until Phase 5 |
| `agent-skills` | Skill markdown (`shared/` + `{userId}/`). Skills Library uploads here. |
| `agent-memory` | Per-user agent memory (`{userId}/{agentId}/`). Folder is created when an agent is cloned. |

There is **no** `resumes` or `documents` storage bucket. Document content lives in `documents.doc_json`.

`handle_new_user` seeds `user_data`, `user_settings`, and folder markers in all four buckets.

## Do not reuse Marketing Agent

Never apply this schema to, or copy IDs from:

- Project `glplvrljdgowcwuubkau` (Marketing Agent DB)
- Vercel project `marketing-agent-truman`

Create a new empty project per fork.

## After apply

Copy the new project’s URL, anon key, and `service_role` key into `nextjs/.env.local` as documented in `nextjs/.env.template`. The service role variable name used by the app is `PRIVATE_SUPABASE_SERVICE_KEY`.

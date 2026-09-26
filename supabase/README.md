# Supabase

Keep-only schema for the slim web starter (Phases 0–6 on `main`).

## Migrations (preferred)

This repo ships a real `supabase/migrations/` history starting at:

- [`migrations/20260913223000_slim_starter_baseline.sql`](./migrations/20260913223000_slim_starter_baseline.sql)
- [`migrations/20260913224500_byok_column_privileges.sql`](./migrations/20260913224500_byok_column_privileges.sql) — `openrouter_api_key` is service-role only
- [`migrations/20260919123000_user_data_social_profile_urls.sql`](./migrations/20260919123000_user_data_social_profile_urls.sql) — optional social profile URLs, including `website_url`
- [`migrations/20260926223000_user_data_registration_provenance.sql`](./migrations/20260926223000_user_data_registration_provenance.sql) — signup provenance columns `application_name` and `website`

Together these are the keep-only schema (documents, not resumes; no contact/assessment/Composio tables).

On a **new empty** Supabase project:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

`npx supabase migrations up --linked` also works once the project is linked.

## Consolidated view

[`schema.sql`](./schema.sql) is the consolidated schema (baseline plus later migrations), kept as a single-file view for reading and optional SQL Editor apply on an empty project. Prefer migrations for forks. Do not re-run `schema.sql` on a project that already applied migrations.

## Storage buckets

| Bucket | Purpose |
|---|---|
| `user-files` | My Files UI. Object key is `{userId}/{sanitizedFileName}`. Folder markers from `handle_new_user` are hidden in the list. |
| `files` | Chat attachments (`{userId}/chat-attachments/{chatId}/…`) |
| `agent-skills` | Skill markdown (`shared/` + `{userId}/`). Skills Library uploads here. |
| `agent-memory` | Per-user agent memory (`{userId}/{agentId}/`). Folder is created when an agent is cloned. |

There is **no** `resumes` or `documents` storage bucket. Document content lives in `documents.doc_json`.

`handle_new_user` seeds `user_data`, `user_settings`, and folder markers in all four buckets.

On each new signup it copies two admin options onto that `user_data` row:

| Admin option | Column | Fallback if the option is missing or blank |
|---|---|---|
| `application_name` | `user_data.application_name` | `boilerplate` |
| `website` | `user_data.website` | `nexjsboilerplate.com` |

Those options are edited in Admin → Site Settings with the other `admin_settings` rows. Saving them changes future signups only. Existing `user_data` rows stay as stamped. Authenticated users can read the stamp on their own row and cannot update `application_name` or `website` (service role can).

`user_data.website` is registration provenance. It is not `user_data.website_url` (the optional social profile link). This starter has no `site_url` admin option; do not use the provenance website as an OAuth or canonical site URL.

## Do not reuse Marketing Agent

Never apply this schema to, or copy IDs from:

- Project `glplvrljdgowcwuubkau` (Marketing Agent DB)
- Vercel project `marketing-agent-truman`

Create a new empty project per fork.

## After apply

Copy the new project’s URL, anon key, and `service_role` key into `nextjs/.env.local` as documented in `nextjs/.env.template`. The service role variable name used by the app is `PRIVATE_SUPABASE_SERVICE_KEY`. Never expose `service_role` to the browser (`NEXT_PUBLIC_*`).

Set `CRON_SECRET` in the Next.js / Vercel server env (not in Supabase). Cron wake ≠ execute — see the root README.

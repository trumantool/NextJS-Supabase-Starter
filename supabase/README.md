# Supabase

Keep-only schema for the slim web starter (Phases 0–6 on `main`).

## Migrations (preferred)

This repo ships a real `supabase/migrations/` history starting at:

- [`migrations/20260913223000_slim_starter_baseline.sql`](./migrations/20260913223000_slim_starter_baseline.sql)
- [`migrations/20260913224500_byok_column_privileges.sql`](./migrations/20260913224500_byok_column_privileges.sql) — `openrouter_api_key` is service-role only
- [`migrations/20260919123000_user_data_social_profile_urls.sql`](./migrations/20260919123000_user_data_social_profile_urls.sql) — optional social URL columns
- [`migrations/20260926234500_admin_settings_login_redirect_url.sql`](./migrations/20260926234500_admin_settings_login_redirect_url.sql) — `admin_settings.login_redirect_url`, seeded with `https://nextjs-supabase-starter-two.vercel.app`
- [`migrations/20261003120000_posts_stripe_token_ledger.sql`](./migrations/20261003120000_posts_stripe_token_ledger.sql) — `posts` (including `website text not null`, check `posts_website_check`, index `posts_website_type_status_idx`), Stripe columns on `user_data`, token ledger, empty OpenRouter admin settings
- [`migrations/20261009140100_posts_body_doc.sql`](./migrations/20261009140100_posts_body_doc.sql) through [`migrations/20261009140600_newsletter_subscribers.sql`](./migrations/20261009140600_newsletter_subscribers.sql) — blog `body_doc`, taxonomy, revisions, media, comments, and newsletter subscribers
- [`migrations/20261009150100_security_definer_execute_revoke.sql`](./migrations/20261009150100_security_definer_execute_revoke.sql) — `REVOKE EXECUTE` on SECURITY DEFINER functions from `PUBLIC`, `anon`, and `authenticated`, then restore the roles that call them

Apply these only on a new empty project you control. Do not apply them to Marketing Agent (`glplvrljdgowcwuubkau`) or any other live database from this change.

That baseline is the keep-only schema (documents, not resumes; no contact/assessment/Composio tables).

On a **new empty** Supabase project:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

`npx supabase migrations up --linked` also works once the project is linked.

## Consolidated view

[`schema.sql`](./schema.sql) is the consolidated schema (baseline plus later migrations), kept as a single-file view. A second SQL Editor paste is safe: tables and indexes use IF NOT EXISTS, triggers and policies are dropped first, and seeds use ON CONFLICT DO NOTHING. Prefer migrations for forks.

## Storage buckets

| Bucket | Purpose |
|---|---|
| `user-files` | My Files UI. Object key is `{userId}/{sanitizedFileName}`. Folder markers from `handle_new_user` are hidden in the list. |
| `files` | Chat attachments (`{userId}/chat-attachments/{chatId}/…`) |
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

Copy the new project’s URL, anon key, and `service_role` key into `nextjs/.env.local` as documented in `nextjs/.env.template`. The service role variable name used by the app is `PRIVATE_SUPABASE_SERVICE_KEY`. Never expose `service_role` to the browser (`NEXT_PUBLIC_*`).

Set `CRON_SECRET` in the Next.js / Vercel server env (not in Supabase). Cron wake ≠ execute — see the root README.

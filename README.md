# Next.js + Supabase Starter

Reusable Next.js 15 + Supabase SaaS starter. The default product is the slim keep set: auth/MFA, files, todos, documents, chat, General and Task Management agents, personal skills, and the user/admin settings those need.

Phases 0–6 of [`docs/plans/slim-starter-feature-extract.md`](./docs/plans/slim-starter-feature-extract.md) are on `main`. This README is the fork path.

Derived from [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template).

## Never reuse Marketing Agent infrastructure

Create a **new empty** Supabase project (and later a **new** Vercel project) for every fork.

Do **not** use:

- Marketing Agent database project ID `glplvrljdgowcwuubkau`
- Vercel project `marketing-agent-truman`
- Any keys, URLs, or project refs copied from those projects

Do not write to `trumantool/marketing-agent` or `onhprojects/supabase-nextjs-starter`. Those repos are reference-only.

Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. The app reads `OPENROUTER_API_KEY` and optional per-user BYOK only.

## Features (slim keep set)

The web app lives in `nextjs/`. Dashboard / nav surfaces:

| Surface | Route | Notes |
|---|---|---|
| Auth / MFA | `/auth/**` | Email/password, optional TOTP |
| Files | `/storage` | `user-files` bucket, objects at `{userId}/{filename}` |
| To Do | `/todos` | Table `todo_list` (`/table` redirects) |
| Documents | `/documents` | TipTap + AI panel + .docx export (`/resume-builder` redirects) |
| Chat | `/chat` | OpenRouter threads. Switcher: General (no agent row), General agent, Task Management |
| Agents | `/agents` | Blank `user_agents` plus the two built-in rows. Marketing templates stay hidden |
| Skills | `/agent-skills` | Personal uploads and the four Task Management markdown files |
| Task Management | `/chat?builtin=task-management` | Ensures one `user_agents` row, then lists and updates that user's `todo_list` |
| User settings | `/user-settings` | Profile, password, MFA, OpenRouter BYOK |
| Admin | `/admin` | Site title/url/support and the AI Docs model |

Marketing template clones and the generic automations scheduler are not in the UI. The scheduler libraries stay in the repo for a later blog-automation phase. There is no `/agent-templates` page and no `/automations` page.

**Out of the default IA:** marketing/ReachThem campaigns, Composio Ads/SEO admin, intake/assessments, and the old contact-product inbox. `/contact` is a static support page only.

## Schema apply (`supabase/migrations/` + `schema.sql` view)

On a **new empty** Supabase project, apply the keep-only baseline:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

That creates only the keep tables and buckets (`user-files`, `files`, `agent-skills`, `agent-memory`). Document content lives in `documents.doc_json` — there is no resumes/documents storage bucket.

[`supabase/schema.sql`](./supabase/schema.sql) is the consolidated schema (baseline plus later migrations), kept as a single-file view. You can paste it into the SQL Editor instead of using the CLI. A second paste is safe: tables and indexes use IF NOT EXISTS, triggers and policies are dropped first, and seeds use ON CONFLICT DO NOTHING.

New signups copy `admin_settings.application_name` and `admin_settings.website` onto `user_data` (fallbacks `boilerplate` and `nexjsboilerplate.com`). Editing those admin options does not rewrite existing users. `user_data.website` is registration provenance, separate from the social profile `website_url`.

Details: [`supabase/README.md`](./supabase/README.md).

## New empty Supabase project checklist

Use this on every fork. Never attach Marketing Agent’s project.

1. Create a **new empty** Supabase project. Confirm the project ref is **not** `glplvrljdgowcwuubkau`.
2. Apply schema: `npx supabase db push --linked` from this repo, **or** paste [`supabase/schema.sql`](./supabase/schema.sql) **once** in the SQL Editor on an empty project.
3. From **Project Settings → API**, copy Project URL, `anon` `public` key, and `service_role` key.
4. Auth → URL configuration: Site URL `http://localhost:3000`, redirect `http://localhost:3000/**`. Hosted later: your production origin and `https://YOUR_DOMAIN/**`.
5. `cd nextjs && cp .env.template .env.local`. Fill from the **new** project. Required keys are listed under [Environment variables](#environment-variables).
6. Generate `CRON_SECRET` with `openssl rand -hex 32`. Put it only in server/Vercel env — never `NEXT_PUBLIC_*`.
7. Set `OPENROUTER_API_KEY` from [openrouter.ai/keys](https://openrouter.ai/keys). Do **not** set `OPENROUTER_API_KEY_REACHTHEMAI`. Admin can also store an empty-by-default `openrouter_api_key` in Admin Settings. Do not paste Marketing or Edu key values.
8. Optional Stripe: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_PRICE_ID` or `STRIPE_PRICE_PLAN_MAP`. Point the webhook at `/api/stripe/webhook`.
9. Set `NEXT_PUBLIC_PRODUCTNAME`.
10. Set `POSTS_WEBSITE` to the site this deployment owns: `edu`, `marketing-agent`, or `afterallcare`. Required for posts. There is no default, and the starter does not assume a site.
11. `npm install && npm run dev` from `nextjs/`. Open [http://localhost:3000](http://localhost:3000).
12. When you deploy: create a **new** Vercel project (never `marketing-agent-truman`). Root Directory = `nextjs`. Set the same server secrets, including `POSTS_WEBSITE`, `CRON_SECRET`, and Stripe keys if you use billing.

## Security reminders

- **No `service_role` on the client.** The app reads it as `PRIVATE_SUPABASE_SERVICE_KEY` in server code only (`serverAdminClient`). Never prefix it with `NEXT_PUBLIC_`. Never ship it in browser bundles.
- **RLS is owner-scoped.** Tables and storage policies use `auth.uid()` / `authenticative.is_user_authenticated()`. Do not weaken policies to “get the demo working.”
- **`CRON_SECRET` stays server-only.** The generic daily automations routes are gone. The secret is unused until a later auto-blog cron. Do not add an hourly schedule on the Hobby plan.

## Local setup

1. Fork or clone this repository.
2. Follow the [new empty Supabase project checklist](#new-empty-supabase-project-checklist).
3. Run the app from `nextjs/`:

   ```bash
   cd nextjs
   npm install
   cp .env.template .env.local
   # fill keys from the NEW empty project
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Canonical list: [`nextjs/.env.template`](./nextjs/.env.template). Grep-verified against `process.env` / `NEXT_PUBLIC_` under `nextjs/`.

| Variable | Required | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon client + middleware |
| `PRIVATE_SUPABASE_SERVICE_KEY` | Yes | `serverAdminClient` (service role, server-only) |
| `OPENROUTER_API_KEY` | Yes for AI | Fallback OpenRouter key after BYOK and `admin_settings.openrouter_api_key` (unless the force-platform flag is on) |
| `STRIPE_SECRET_KEY` | No | Checkout, Customer Portal, and webhook signature verification |
| `STRIPE_WEBHOOK_SECRET` | No | `POST /api/stripe/webhook` |
| `STRIPE_PRICE_ID` | No | Default Checkout price. Overrides `STRIPE_PRICE_PLAN_MAP` |
| `STRIPE_PRICE_PLAN_MAP` | No | `price_xxx:plan` pairs written onto `user_data.plan` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Marks Checkout as configured. Hosted Checkout does not load Stripe.js |
| `NEXT_PUBLIC_PRODUCTNAME` | Yes | Title, header, footer, homepage |
| `POSTS_WEBSITE` | Yes for posts | Site written to and filtered on `public.posts.website`. Allowed: `edu`, `marketing-agent`, `afterallcare`. No default |
| `ADMIN_SETTINGS_APP_KEY` | No | Which `admin_settings` rows this deployment reads and writes. Unset or blank does not mention `app_key`, so a table without that column still works. Set a unique value only after the app_key migration exists. Server-only |
| `CRON_SECRET` | No until auto-blog | Server-only bearer secret. Unused while `vercel.json` has no cron entries |
| `NEXT_PUBLIC_THEME` | No | Body theme class (default `theme-sass3`) |
| `NEXT_PUBLIC_GOOGLE_TAG` | No | Google Analytics |
| `NEXT_PUBLIC_SSO_PROVIDERS` | No | Comma list: `github`, `google`, `facebook`, `apple` |
| `NEXT_PUBLIC_TIERS_*` / `NEXT_PUBLIC_POPULAR_TIER` / `NEXT_PUBLIC_COMMON_FEATURES` | No | Homepage pricing demo |

`NODE_ENV` is set by Next.js. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. Do not add Composio or Treg keys.

### Admin settings on a shared database

`public.admin_settings` can hold more than one app once `app_key` exists. Leave `ADMIN_SETTINGS_APP_KEY` unset on a database that has no `app_key` column, including the shared production database: this deployment then does not filter, select, or write `app_key`, and saves conflict on `option_name`. On a database that has the column, unset still does not add an `app_key` filter, so set the variable before sharing that database with another app. Site title, contact info, privacy, terms, and the other non-secret settings stay on the public pages. `secret` and `password` values are not selectable with the anon or authenticated key. The admin UI receives a blank field plus a flag that says whether a value is saved. An empty save keeps the stored value. **Clear saved value** stores an empty string. OpenRouter key resolution reads the row on the server with the service role.

A clone that shares the database with other apps sets `ADMIN_SETTINGS_APP_KEY` to a unique slug, applies the latest migration (or pastes `supabase/schema.sql` on a new project), and copies its own rows. Until those rows exist, this deployment sees no admin settings and public pages use their code defaults.

```sql
INSERT INTO public.admin_settings (
  app_key, option_name, option_value, option_field_type, option_title, option_description
)
SELECT
  'your-app-key',
  option_name,
  CASE WHEN option_field_type IN ('secret', 'password') THEN '' ELSE option_value END,
  option_field_type,
  option_title,
  option_description
FROM public.admin_settings
WHERE app_key IS NULL
ON CONFLICT (app_key, option_name) DO NOTHING;
```

Use the same slug in `ADMIN_SETTINGS_APP_KEY`. Do not prefix it with `NEXT_PUBLIC_`. The variable is listed in [`nextjs/.env.template`](./nextjs/.env.template) and [`nextjs/.env.example`](./nextjs/.env.example).

## Deploy (later — not provisioned by this repo)

This repo does **not** create a Vercel or Supabase project for you.

When you deploy, create a **new** Vercel project pointed at this fork. Set the Next.js **Root Directory** to `nextjs`. [`nextjs/vercel.json`](./nextjs/vercel.json) has no cron entries. Set the same keys from `nextjs/.env.local` as Vercel environment variables, including `PRIVATE_SUPABASE_SERVICE_KEY`. Keep `CRON_SECRET` if it is already set; nothing calls it until auto-blog. Update Supabase Auth site URL and redirect URLs to the production origin.

Do not attach Marketing Agent’s Vercel project or database.

## Crons

[`nextjs/vercel.json`](./nextjs/vercel.json) has no cron entries. The generic automations pages, API routes, and the two daily schedules are removed. `nextjs/src/lib/automations.ts`, `automation-schedule.ts`, `automation-worker.ts`, and `cron-auth.ts` stay so a later blog-automation phase can use them. `CRON_SECRET` stays in the env template and is unused until that phase. Do not add `0 * * * *` on the Hobby plan.

## Expo (unsupported in the slim web starter)

`supabase-expo-template/` is leftover Expo sample code. It is **unsupported** on the slim web starter path. Do not expand it. Do not treat [`README_MOBILE.md`](./README_MOBILE.md) as required setup.

## Docs that are **not** in this repo

The previous README claimed files that are not present. Do not look for:

- `README_ZH.md` / `README_MOBILE_ZH.md` — not in this repository
- `supabase/migrations_for_old/` — not present
- Root `.env.template` — the template is `nextjs/.env.template`

`.github/skills/app-build-plans/` holds historical resume-builder notes. Do not follow them for this starter.

## Legal documents

Markdown templates used by the web app:

- `nextjs/public/terms/privacy-notice.md`
- `nextjs/public/terms/terms-of-service.md`
- `nextjs/public/terms/refund-policy.md`

## Theming

Set `NEXT_PUBLIC_THEME` to one of: `theme-sass`, `theme-sass2`, `theme-sass3` (default), `theme-blue`, `theme-purple`, `theme-green`.

## License

Apache License — see [LICENSE](./LICENSE).

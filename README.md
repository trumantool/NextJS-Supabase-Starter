# Next.js + Supabase Starter

Reusable Next.js 15 + Supabase SaaS starter. The default product is the slim keep set: auth/MFA, files, todos, documents, chat, agents/skills/templates, automations, and the user/admin settings those need.

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
| Chat | `/chat` | OpenRouter threads, agent switcher, skill context, attachments on `files` |
| Agents | `/agents` | `user_agents` — `skill_ids`, `defaults.model_id`, clone from a template |
| Skills | `/agent-skills` | Shared vs mine; bucket `agent-skills` |
| Templates | `/agent-templates` | Published gallery; admin CRUD under Admin → Agent Templates |
| Automations | `/automations` | Schedule + Run now + run history. OpenRouter + skills only (no Composio) |
| User settings | `/user-settings` | Profile, password, MFA, OpenRouter BYOK |
| Admin | `/admin` | Site title/url/support, AI Docs model, agent templates |

The starter ships **one** generic Starter Assistant recipe (no SEO/Ads seeds).

**Out of the default IA:** marketing/ReachThem campaigns, Composio Ads/SEO admin, intake/assessments, and the old contact-product inbox. `/contact` is a static support page only.

## Schema apply (`supabase/migrations/` + `schema.sql` view)

On a **new empty** Supabase project, apply the keep-only baseline:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

That creates only the keep tables and buckets (`user-files`, `files`, `agent-skills`, `agent-memory`). Document content lives in `documents.doc_json` — there is no resumes/documents storage bucket.

[`supabase/schema.sql`](./supabase/schema.sql) is the same SQL as the baseline migration, kept as a consolidated view. You can paste it into the SQL Editor on an empty project instead of using the CLI. Do not re-run it on a project that already applied migrations.

Details: [`supabase/README.md`](./supabase/README.md).

## New empty Supabase project checklist

Use this on every fork. Never attach Marketing Agent’s project.

1. Create a **new empty** Supabase project. Confirm the project ref is **not** `glplvrljdgowcwuubkau`.
2. Apply schema: `npx supabase db push --linked` from this repo, **or** paste [`supabase/schema.sql`](./supabase/schema.sql) **once** in the SQL Editor on an empty project.
3. From **Project Settings → API**, copy Project URL, `anon` `public` key, and `service_role` key.
4. Auth → URL configuration: Site URL `http://localhost:3000`, redirect `http://localhost:3000/**`. Hosted later: your production origin and `https://YOUR_DOMAIN/**`.
5. `cd nextjs && cp .env.template .env.local`. Fill from the **new** project. Required keys are listed under [Environment variables](#environment-variables).
6. Generate `CRON_SECRET` with `openssl rand -hex 32`. Put it only in server/Vercel env — never `NEXT_PUBLIC_*`.
7. Set `OPENROUTER_API_KEY` from [openrouter.ai/keys](https://openrouter.ai/keys). Do **not** set `OPENROUTER_API_KEY_REACHTHEMAI`.
8. Set `NEXT_PUBLIC_PRODUCTNAME`.
9. `npm install && npm run dev` from `nextjs/`. Open [http://localhost:3000](http://localhost:3000).
10. When you deploy: create a **new** Vercel project (never `marketing-agent-truman`). Root Directory = `nextjs`. Set the same server secrets, including `CRON_SECRET`.

## Security reminders

- **No `service_role` on the client.** The app reads it as `PRIVATE_SUPABASE_SERVICE_KEY` in server code only (`serverAdminClient`). Never prefix it with `NEXT_PUBLIC_`. Never ship it in browser bundles.
- **RLS is owner-scoped.** Tables and storage policies use `auth.uid()` / `authenticative.is_user_authenticated()`. Do not weaken policies to “get the demo working.”
- **`CRON_SECRET` on worker/cron only.** `/api/cron/automations` and `/api/workers/automations` return 401 if the bearer token is missing or wrong. Cron **wakes** a queue; it does not run the model. See [Automations cron](#automations-cron-wake--execute).

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
| `OPENROUTER_API_KEY` | Yes for AI | Platform OpenRouter key for Documents, Chat, and Automations (users may override with BYOK) |
| `NEXT_PUBLIC_PRODUCTNAME` | Yes | Title, header, footer, homepage |
| `CRON_SECRET` | Yes for cron | Bearer secret for `/api/cron/automations` and `/api/workers/automations` |
| `NEXT_PUBLIC_THEME` | No | Body theme class (default `theme-sass3`) |
| `NEXT_PUBLIC_GOOGLE_TAG` | No | Google Analytics |
| `NEXT_PUBLIC_SSO_PROVIDERS` | No | Comma list: `github`, `google`, `facebook`, `apple` |
| `NEXT_PUBLIC_TIERS_*` / `NEXT_PUBLIC_POPULAR_TIER` / `NEXT_PUBLIC_COMMON_FEATURES` | No | Homepage pricing demo |

`NODE_ENV` is set by Next.js. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. Do not add Composio or Treg keys.

## Deploy (later — not provisioned by this repo)

This repo does **not** create a Vercel or Supabase project for you.

When you deploy, create a **new** Vercel project pointed at this fork. Set the Next.js **Root Directory** to `nextjs` so [`nextjs/vercel.json`](./nextjs/vercel.json) cron entries apply. Set the same keys from `nextjs/.env.local` as Vercel environment variables, including `CRON_SECRET` and `PRIVATE_SUPABASE_SERVICE_KEY`. Update Supabase Auth site URL and redirect URLs to the production origin.

Do not attach Marketing Agent’s Vercel project or database.

## Automations cron (wake ≠ execute)

Vercel Cron hits both paths every **5 minutes** (`*/5 * * * *`):

| Path | Role |
|---|---|
| `GET /api/cron/automations` | Enqueue due `active` automations onto `automation_runs` (`trigger=schedule`). Does **not** call OpenRouter. |
| `GET /api/workers/automations` | Fail stale `running` rows, claim up to 5 `queued` rows, execute OpenRouter + skills, write `output`. |

A cron wake only enqueues or claims. A run executes later on the worker tick. `Run now` in the UI also only **enqueues** (`trigger=manual`); it does not skip the worker.

Both endpoints require `Authorization: Bearer $CRON_SECRET` and use the service-role client server-side. Hobby Vercel plans may only allow one cron per day — Pro (or a manual curl) is needed for the 5-minute cadence.

### Manual test (enqueue + execute)

1. Sign in, create an automation at `/automations/new`, then click **Run now** (or `POST /api/automations/<id>/run` while signed in).
2. Wake the worker with the same secret Vercel Cron would send:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/workers/automations
```

3. Open `/automations/<id>` and expand the newest run to read the transcript.

To enqueue due scheduled jobs without waiting for Vercel:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/automations
```

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

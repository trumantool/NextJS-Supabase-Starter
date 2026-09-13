# Next.js + Supabase Starter

Reusable Next.js 15 + Supabase SaaS starter. This repo is being slimmed to keep auth, file uploads, documents + AI editing, todos, generic AI chat/agents/skills, automations, and the user/admin settings those need.

The keep / port / drop plan is in [`docs/plans/slim-starter-feature-extract.md`](./docs/plans/slim-starter-feature-extract.md). Phases 0–6 are in: hygiene, keep-only schema, hardened Files / To Do / BYOK / admin / branding, Documents, Agents / Skills / Templates, Chat, and Automations. Phase 7 is forkability polish.

Derived from [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template).

## Never reuse Marketing Agent infrastructure

Create a **new empty** Supabase project (and later a **new** Vercel project) for every fork.

Do **not** use:

- Marketing Agent database project ID `glplvrljdgowcwuubkau`
- Vercel project `marketing-agent-truman`
- Any keys, URLs, or project refs copied from those projects

Do not write to `trumantool/marketing-agent` or `onhprojects/supabase-nextjs-starter`. Those repos are reference-only.

## What exists today

The web app lives in `nextjs/`. Current dashboard surfaces:

- Authentication (email/password, MFA)
- File uploads (`user-files` bucket, objects at `{userId}/{filename}`)
- To-dos (`/todos`, table `todo_list`; `/table` redirects)
- Documents (`/documents`, table `documents`) — TipTap editor, AI panel, .docx export; `/resume-builder` redirects here
- Agents (`/agents`, table `user_agents`) — create/edit, attach `skill_ids`, set `defaults.model_id`, clone from a template
- Skills Library (`/agent-skills`, table `agent_skills`, bucket `agent-skills`) — upload/list shared vs mine
- Agent Templates (`/agent-templates`, table `agent_templates`) — published gallery; admin CRUD under Admin → Agent Templates
- Chat (`/chat`, tables `chats` / `messages`) — OpenRouter threads, agent switcher, skills-as-context, attachments on the `files` bucket
- Automations (`/automations`, tables `automations` / `automation_runs`) — CRUD, grok-style schedule presets, Run now, run history/transcript. Worker uses OpenRouter + skills only (no Composio)
- User settings (profile, password, MFA, OpenRouter BYOK) and admin site settings + AI Docs model

The starter ships **one** generic Starter Assistant recipe (no SEO/Ads seeds).

`supabase-expo-template/` is an optional Expo sample. It is **not** part of the slim web starter path. Do not expand it for v1.

## Schema — prefer migrations

On a **new empty** Supabase project, apply the keep-only baseline:

```bash
npx supabase login
npx supabase link
npx supabase db push --linked
```

That creates only the keep tables and buckets (`user-files`, `files`, `agent-skills`, `agent-memory`). Document content lives in `documents.doc_json` — there is no resumes/documents storage bucket.

[`supabase/schema.sql`](./supabase/schema.sql) is the same SQL as the baseline migration, kept as a consolidated view. You can paste it into the SQL Editor on an empty project instead of using the CLI. Do not re-run it on a project that already applied migrations.

Details: [`supabase/README.md`](./supabase/README.md).

## Local setup

1. Fork or clone this repository.

2. Create a **new empty** Supabase project (not Marketing Agent).

3. Apply migrations (`npx supabase db push --linked`) or paste [`supabase/schema.sql`](./supabase/schema.sql) once in the SQL Editor on an empty project.

4. From **Project Settings → API**, copy:
   - Project URL
   - `anon` `public` key
   - `service_role` key (server-only)

5. In the Supabase Auth settings, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/**` to redirect URLs. `supabase/config.toml` already uses those values for local CLI work; hosted projects must be set in the dashboard.

6. Install and configure the Next.js app:

   ```bash
   cd nextjs
   npm install
   cp .env.template .env.local
   ```

7. Fill `nextjs/.env.local` from your **new** project. Required keys:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `PRIVATE_SUPABASE_SERVICE_KEY` (this is the `service_role` secret; the app does not read `SUPABASE_SERVICE_ROLE_KEY`)
   - `OPENROUTER_API_KEY` (needed for Documents AI, Chat, and Automations)
   - `NEXT_PUBLIC_PRODUCTNAME`
   - `CRON_SECRET` (needed to wake automations cron/worker; generate with `openssl rand -hex 32`)

   See [`nextjs/.env.template`](./nextjs/.env.template) for optional site, theme, SSO, and pricing keys. Composio keys are out of v1.

8. Run the app from `nextjs/`:

   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Canonical list: [`nextjs/.env.template`](./nextjs/.env.template). Grep-verified against `process.env` / `NEXT_PUBLIC_` under `nextjs/`.

| Variable | Required | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser + server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon client + middleware |
| `PRIVATE_SUPABASE_SERVICE_KEY` | Yes | `serverAdminClient` (service role) |
| `OPENROUTER_API_KEY` | Yes for AI | Platform OpenRouter key for Documents, Chat, and Automations (users may override with BYOK) |
| `NEXT_PUBLIC_PRODUCTNAME` | Yes | Title, header, footer, homepage |
| `NEXT_PUBLIC_THEME` | No | Body theme class (default `theme-sass3`) |
| `NEXT_PUBLIC_GOOGLE_TAG` | No | Google Analytics |
| `NEXT_PUBLIC_SSO_PROVIDERS` | No | Comma list: `github`, `google`, `facebook`, `apple` |
| `NEXT_PUBLIC_TIERS_*` / `NEXT_PUBLIC_POPULAR_TIER` / `NEXT_PUBLIC_COMMON_FEATURES` | No | Homepage pricing demo |
| `CRON_SECRET` | Yes for cron | Bearer secret for `/api/cron/automations` and `/api/workers/automations` |

`NODE_ENV` is set by Next.js. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. The app reads `OPENROUTER_API_KEY` and optional per-user BYOK keys only.

## Deploy (later — not provisioned by this repo)

When you deploy, create a **new** Vercel project pointed at this repo. Set the Next.js **Root Directory** to `nextjs` so [`nextjs/vercel.json`](./nextjs/vercel.json) cron entries apply. Set the same keys from `nextjs/.env.local` as Vercel environment variables, including `CRON_SECRET`. Update Supabase Auth site URL and redirect URLs to the production origin (`https://YOUR_DOMAIN/**`).

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

## Docs that are **not** in this repo

The previous README claimed files that are not present. Do not look for:

- `README_ZH.md` / `README_MOBILE_ZH.md` — not in this repository
- `supabase/migrations_for_old/` — not present
- Root `.env.template` — the template is `nextjs/.env.template`

`README_MOBILE.md` describes the optional Expo folder only.

## Legal documents

Markdown templates used by the web app:

- `nextjs/public/terms/privacy-notice.md`
- `nextjs/public/terms/terms-of-service.md`
- `nextjs/public/terms/refund-policy.md`

## Theming

Set `NEXT_PUBLIC_THEME` to one of: `theme-sass`, `theme-sass2`, `theme-sass3` (default), `theme-blue`, `theme-purple`, `theme-green`.

## License

Apache License — see [LICENSE](./LICENSE).

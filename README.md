# Next.js + Supabase Starter

Reusable Next.js 15 + Supabase SaaS starter. This repo is being slimmed to keep auth, file uploads, documents + AI editing, todos, generic AI chat/agents/skills, automations, and the user/admin settings those need.

The keep / port / drop plan is in [`docs/plans/slim-starter-feature-extract.md`](./docs/plans/slim-starter-feature-extract.md). Phases 0–2 are in: hygiene, keep-only schema, and hardened Files / To Do / BYOK / admin / branding. Later phases generalize Documents and port chat/agents/automations.

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
- TipTap + OpenRouter editor (`/resume-builder`, table `documents`) — Phase 3 renames this to Documents
- User settings (profile, password, MFA, OpenRouter BYOK) and admin site settings + AI Docs model

Chat, agents, skills, and automations tables exist in the schema but have **no UI yet** (Phases 4–6).

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
   - `OPENROUTER_API_KEY` (needed for the document AI panel)
   - `NEXT_PUBLIC_PRODUCTNAME`

   See [`nextjs/.env.template`](./nextjs/.env.template) for optional site, theme, SSO, pricing, and reserved `CRON_SECRET` keys. Composio keys are out of v1.

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
| `OPENROUTER_API_KEY` | Yes for AI | Platform OpenRouter key (users may override with BYOK) |
| `NEXT_PUBLIC_PRODUCTNAME` | Yes | Title, header, footer, homepage |
| `NEXT_PUBLIC_THEME` | No | Body theme class (default `theme-sass3`) |
| `NEXT_PUBLIC_GOOGLE_TAG` | No | Google Analytics |
| `NEXT_PUBLIC_SSO_PROVIDERS` | No | Comma list: `github`, `google`, `facebook`, `apple` |
| `NEXT_PUBLIC_TIERS_*` / `NEXT_PUBLIC_POPULAR_TIER` / `NEXT_PUBLIC_COMMON_FEATURES` | No | Homepage pricing demo |
| `CRON_SECRET` | Reserved | Phase 6 automations cron/worker (not read yet) |

`NODE_ENV` is set by Next.js. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. The app reads `OPENROUTER_API_KEY` and optional per-user BYOK keys only.

## Deploy (later — not provisioned by this repo)

When you deploy, create a **new** Vercel project pointed at this repo. Set the same keys from `nextjs/.env.local` as Vercel environment variables. Update Supabase Auth site URL and redirect URLs to the production origin (`https://YOUR_DOMAIN/**`).

Do not attach Marketing Agent’s Vercel project or database.

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

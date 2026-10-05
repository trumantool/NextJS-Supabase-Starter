# Next.js app

This is the web app for the starter. Run everything from this directory.

Full fork setup (new empty Supabase project checklist, migrations, env keys, cron) lives in the [root README](../README.md). Prefer `npx supabase db push --linked` from the repo root; [`supabase/schema.sql`](../supabase/schema.sql) is the consolidated view of the same baseline.

## Local

```bash
cp .env.template .env.local
# fill keys from a NEW empty Supabase project — never Marketing Agent IDs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required keys and comments: [`.env.template`](./.env.template). Include `CRON_SECRET` if you will hit `/api/cron/automations` or `/api/workers/automations`.

Keep surfaces: Files (`user-files`, `{userId}/{sanitizedFileName}`), chat attachments (`files`, `{userId}/chat-attachments/{chatId}/…`), To Do (`/todos`; `/table` redirects), Documents, Chat, Agents / Skills / Templates, Automations, User Settings, Admin.

OpenRouter BYOK is saved through `/api/user/byok-key` and stored in `user_settings.openrouter_api_key` (service role only). Resolution is BYOK, then `admin_settings.openrouter_api_key`, then `OPENROUTER_API_KEY`, unless `openrouter_force_platform_key` is true. Chat and automations record token usage with `record_llm_turn_usage`. Posts are authored at `/my-posts` and published at `/posts`. Every post read filters `posts.website`, and every insert or update sets it, from the required server env `POSTS_WEBSITE` (`edu`, `marketing-agent`, or `afterallcare`). That variable has no default. Public post pages render on each request, so `next build` does not choose a site. Stripe billing is on User Settings. No Composio tools.

## Security

- Never put `PRIVATE_SUPABASE_SERVICE_KEY` in a `NEXT_PUBLIC_*` variable or client component.
- RLS is owner-scoped. Do not disable it for local convenience.
- `CRON_SECRET` is server-only. Cron wake ≠ execute (see root README).

Do not add Composio env vars. Do not use project ID `glplvrljdgowcwuubkau` or Vercel project `marketing-agent-truman`. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`.

# Next.js app

This is the web app for the starter. Run everything from this directory.

Full fork setup (new empty Supabase project, migrations, env keys) lives in the [root README](../README.md). Prefer `npx supabase db push --linked` from the repo root; [`supabase/schema.sql`](../supabase/schema.sql) is the consolidated view of the same baseline.

## Local

```bash
cp .env.template .env.local
# fill keys from a NEW empty Supabase project — never Marketing Agent IDs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required keys and comments: [`.env.template`](./.env.template).

My Files uses the `user-files` bucket. Object keys are `{userId}/{sanitizedFileName}`. Chat attachments use the `files` bucket at `{userId}/chat-attachments/{chatId}/…`. To-dos live at `/todos` (`/table` redirects). OpenRouter BYOK is saved through `/api/user/byok-key` and stored in `user_settings.openrouter_api_key` (service role only). Chat (`/chat`) streams OpenRouter replies and injects an agent’s skill markdown as system context. No Composio tools.

Do not add Composio env vars. Do not use project ID `glplvrljdgowcwuubkau` or Vercel project `marketing-agent-truman`.

# Next.js app

This is the web app for the starter. Run everything from this directory.

Full fork setup (new empty Supabase project, schema apply, env keys) lives in the [root README](../README.md).

## Local

```bash
cp .env.template .env.local
# fill keys from a NEW empty Supabase project — never Marketing Agent IDs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required keys and comments: [`.env.template`](./.env.template).

Do not add Composio env vars. Do not use project ID `glplvrljdgowcwuubkau` or Vercel project `marketing-agent-truman`.

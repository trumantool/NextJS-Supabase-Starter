# Supabase (v1)

## Migrations decision (Phase 0)

This repo does **not** ship `supabase/migrations/` yet.

v1 setup: apply [`schema.sql`](./schema.sql) **once** on a **new empty** Supabase project (Dashboard → SQL Editor → run the file).

Why not real migrations in Phase 0:

- `schema.sql` is an idempotent dump (`IF NOT EXISTS` / `DROP IF EXISTS`), not a linear migration history.
- Splitting it into incremental migrations would rewrite the current baseline.
- Phase 1 slims the schema to the keep-only tables/buckets and **will introduce** `supabase/migrations/` from that slim dump.

`npx supabase migrations up --linked` will fail until Phase 1 lands migrations. `config.toml` still references `./seed.sql` for local CLI reset; that file is not present and is unused for hosted v1 setup.

## Do not reuse Marketing Agent

Never apply this schema to, or copy IDs from:

- Project `glplvrljdgowcwuubkau` (Marketing Agent DB)
- Vercel project `marketing-agent-truman`

Create a new empty project per fork.

## After apply

Copy the new project’s URL, anon key, and `service_role` key into `nextjs/.env.local` as documented in `nextjs/.env.template`. The service role variable name used by the app is `PRIVATE_SUPABASE_SERVICE_KEY`.

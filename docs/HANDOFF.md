# Handoff

Onboarding for a backup agent continuing this repo. Read this before changing code, opening a pull request, or touching environment or database state.

## Repo and stack

- GitHub: `trumantool/NextJS-Supabase-Starter`
- App: `nextjs/` (Next.js 15 App Router, React 19, Supabase SSR, TipTap, OpenRouter chat)
- Tests: `cd nextjs && npm test` (`node --experimental-strip-types --test` on the files listed in `nextjs/package.json`)
- Build and typecheck: `cd nextjs && npm run build` (Next also lints). There is no separate typecheck script. Use `nextjs/node_modules/.bin/tsc --noEmit` if you need types only. Do not `npx tsc` (that installs the wrong package).
- Schema files live in `supabase/`. They are reference SQL for a **new empty** project. They are not a license to change the live databases below.

`main` includes the empty checkpoint commit `4ba6932` ("Pre Functionality Removal") by Truman Tool. Branch feature work from current `main` unless you are stacking on an open cleanup PR.

## Deploy

- Vercel project: `prj_3cb9stMtDKXlMzEqSG3AaPMg4b0d`
- Live: https://nextjs-supabase-starter-two.vercel.app
- Root directory on Vercel is `nextjs/`
- Merges to `main` auto-deploy
- The project is on the **Hobby** plan. Vercel crons on Hobby run **daily** only. Do not add an hourly cron (`0 * * * *` or similar). `nextjs/vercel.json` is currently `{}` (no cron entries). `CRON_SECRET` stays in env for a later Phase B route and is unused until then.

## Environment

Copy `nextjs/.env.template` to `nextjs/.env.local`. `nextjs/.env.example` only calls out the two posts/settings keys. Production values that matter for this deployment:

| Variable | This deployment |
|---|---|
| `POSTS_WEBSITE` | `marketing-agent` |
| `ADMIN_SETTINGS_APP_KEY` | blank. Blank means **unscoped**: the app does not filter, select, or write `app_key`. |
| `CRON_SECRET` | set on the server. Unused until Phase B. Never `NEXT_PUBLIC_`. |

Also set the rest from `.env.template`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_KEY` (this app does **not** read `SUPABASE_SERVICE_ROLE_KEY`), `OPENROUTER_API_KEY`, `NEXT_PUBLIC_PRODUCTNAME`, and optional Stripe, site origin, theme, Google tag, and SSO keys. Do not set `OPENROUTER_API_KEY_REACHTHEMAI`. Do not commit `.env.local`.

## Databases — do not write

Two Supabase projects are off limits for agents:

- **Shared production** `glplvrljdgowcwuubkau`. Used by marketing-agent, this app, Edu, and a local business site. Do not run SQL, DDL, migrations, restores, or unpause against it. Do not connect to it from an agent session.
- **Starter** `cyczlgdaocwueaacqxsh`. Stays **paused**. Do not restore or unpause it. Do not connect to it.

The only runtime data write the cleanup added is one `user_agents` row per user, the first time that user picks the General agent or Task Management agent.

`posts.website` is a hard filter. Allowed values are `edu`, `marketing-agent`, and `afterallcare`. There is no default. This deployment uses `marketing-agent`. If `POSTS_WEBSITE` is unset or invalid, public post pages, RSS, and the sitemap render empty and log a warning. Writes return a configuration error.

Keep the anon-safe RLS rules from PRs #20 and #21. No anonymous policy may call `is_admin`. Keep the secret-safe `admin_settings` behavior: `secret` and `password` field types are not returned to anon or to the public privacy/terms readers, and a blank concealed save does not wipe the stored value.

Migration `supabase/migrations/20261010160000_admin_settings_app_scope.sql` (PR #20) is **unapplied** on the shared database. Do not apply it. While `app_key` is absent, `ADMIN_SETTINGS_APP_KEY` stays blank.

If code needs a column or table the shared database might lack, degrade the way PR #21 does. Detect missing-relation errors `42P01`, `42703`, `PGRST200`, `PGRST204`, and `PGRST205`, log the gap, and fall back (hide the feature or skip the optional column). Do not add a migration unless a human plan explicitly asks for the file, and never apply it yourself.

## Agents and skills after cleanup

Shipped on the stacked cleanup branches (not necessarily merged):

- The 12 marketing `agent_templates` rows stay in the database and are hidden in the UI. Nothing deletes them. New clones of those templates are rejected. Existing user-agent clones stay in the table and are hidden, because deleting them would cascade into chats.
- Two code agents, neither of which is an `agent_templates` row:
  - **General** in the chat switcher is plain chat. `chats.agent_id` is null. It does not insert a `user_agents` row and does not load catalog skills.
  - **General agent** and **Task Management** each ensure one visible `user_agents` row the first time that user selects them (`source_template_id` null, `defaults.builtinKey` of `general` or `task-management`). Later threads store that row's uuid. The server reads `builtinKey` from the row. A client cannot set it on a non-builtin agent. Deleting a builtin row returns 400.
- Task Management always appends the four markdown files in `nextjs/src/lib/builtin-skills/task-management/` and registers list/create/complete/delete tools against `todo_list` only (owner-scoped). Those files are not skill ids and do not count toward the 8-skill cap. General agent does not register task tools.
- `ALLOWED_SHARED_SKILL_IDS` is empty. Shared skill rows (`user_id` null) cannot be attached or previewed. Personal skills (`user_id` = the caller) stay visible. Users assign them with `user_agents.skill_ids` (max 8).
- `/todos` and `todo_list` stay. Do not create `todo_categories`. Do not add `chats.platform_agent_key`.
- There is no `/agent-templates` page and no `/automations` page. The generic automations product, its API, and its two daily crons are removed. `nextjs/src/lib/automations.ts`, `automation-schedule.ts`, `automation-worker.ts`, and `cron-auth.ts` stay on disk for Phase B and are not linked from the UI.

## Blog

Phase A is on the blog branch (see pull requests below). It is the marketing-agent #150 dashboard behavior, built from the cleanup plan checklist:

- Admin left sidebar: **Blog → My Posts** (`/admin/blog`). Non-admins keep **Posts** (`/my-posts`) and a **Blog** link that opens `/posts` in a new tab.
- The public header **Blog** link stays a top-level nav item (`/posts`). This repo has no Services item, so Blog is not inside a Services dropdown. Do not rename `/posts` to `/blog`.
- My Posts shows a cover, a short preview, Edit, and Delete. Delete confirms with the title and sets `posts.deleted_at`. It never calls `.delete()` on `posts`. Soft-deleted rows drop out of the public roll and the admin list.
- If `posts.deleted_at` is missing, the code logs the schema gap (`logBlogSchemaGap`) and the delete returns an error. The row is not hard-deleted. Reads retry without the filter. Optional SEO columns (`seo_title`, `meta_description`, `og_image_url`), `cover_image_alt`, and `body_doc` are stripped and the write retried when PostgREST reports them missing.
- The editor keeps TipTap mounted across Visual and HTML. HTML is sanitized before it is written back. A dirty editor asks before leave (`beforeunload` and the Back control) and before discarding the other tab. Cover alt text and the SEO title, meta description, and Open Graph image are on the form. YouTube inserts render through `youtube-nocookie.com`. `?from=admin` returns to `/admin/blog`. Otherwise Back returns to `/my-posts`.
- An admin can edit any post. Updates do not change `author_id`.
- `supabase/migrations/20261013120000_posts_editor_legal_settings.sql` adds those columns, the soft-delete policies, and the legal setting keys. It is **unapplied**. Do not apply it.

**Phase B is pending.** Do not implement auto-blog (marketing-agent #141–#148). Do not add Post Automations to the sidebar. Do not add a cron. Phase B waits until the Chief of Staff confirms its migrations and Truman decides whether to move this Vercel project to Pro (Hobby cannot run an hourly cron).

## Legal pages

`/terms` and `/privacy` already loaded `admin_settings` and replaced shortcodes before the legal-pages work. That behavior stayed. The pages now also replace `[site_url]`, `[contact_email]`, and `[effective_date]`, and they still replace `[company_name]`, `[site_title]`, `[support_email]`, `[site_tagline]`, `[contact_address]`, `[support_hours]`, and `[phone_number]`.

Blank identity values use generic phrases (`the site operator`, `this website`, `the contact email published for this site`, `the date this page was last updated`). A blank `[contact_email]` uses `support_email` when that row has a value. A missing or blank terms or privacy body uses generic HTML in code. That fallback does not say Reach Them AI. Stored body text is left as Truman saved it, including any live copy that still says Reach Them AI. Do not rewrite that copy in the shared database.

Admins edit `company_name`, `site_url`, `contact_email`, and `effective_date` on both pages. Saving creates a missing key. A missing `admin_settings` table or column (`42P01`, `42703`, `PGRST200`, `PGRST204`, `PGRST205`) returns an empty list on read and an error on save. The public page stays up on the generic fallback. Secret and password rows stay out of these readers.

Plan: `docs/plans/legal-pages-shortcodes.md`.

## Open pull requests

Plan PRs, still open, not merged:

- #18 sitemap, awaiting Truman
- #25 cleanup plan (`docs/plans/starter-cleanup-marketing-only-removal.md`)

Implementation of that plan, stacked and ready for review, not merged:

1. #26 templates, agents, and skills. Base: `main`.
2. #27 automations removal and dashboard cards/nav. Base: the #26 branch.
3. #28 blog Phase A. Base: the #27 branch.
4. The handoff PR that adds this file. Base: the #28 branch.

Later, stacked on current `main` after that cleanup:

5. Blog editor parity with marketing-agent #150. Base: `main`. Branch `cursor/blog-parity-150-0998`.
6. Legal shortcodes, the unapplied posts/legal migration, and this handoff update. Base: the blog parity branch. Branch `cursor/legal-pages-sql-0998`.

## How to commit and open a PR

Every commit has author **and** committer `Truman Tool <admin@trumantool.com>`. Set repo-local `user.name` and `user.email` before the first commit. Confirm with:

```bash
git log --format='%an <%ae> | %cn <%ce>'
```

No force-push. No secrets in commits.

Open each PR ready for review (not draft) and **do not merge**. Truman reviews each one. Say the base branch in the PR body. Stack later work on the previous branch when the change depends on it. Each app PR must pass `npm test` and `npm run build` in `nextjs/`.

`trumantool/marketing-agent` is read-only reference. Do not push, comment, or open anything there.

## Known open items

- Live privacy and terms copy still says Reach Them AI. Those pages render `admin_settings` rows (`privacy_policy` and the terms equivalent), not the SupaSasS markdown under `nextjs/public/terms/`. Do not "fix" that copy by rewriting the shared database from an agent session. Truman edits it in Admin Settings when he wants it changed.
- `SUPABASE_ACCESS_TOKEN` should be removed from the Vercel project env. The app does not need it, and it is a management credential. Do not print the value. Do not use it to call the Supabase management API against either project above.

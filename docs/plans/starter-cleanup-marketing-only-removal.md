# Starter cleanup — remove marketing-agent-only code

**CODE-ONLY. NO DATABASE CHANGES OF ANY KIND: no migrations, no SQL, no RLS/policy edits, no seed or row deletes, no restores, no new migration files. The live starter runs on the shared Supabase glplvrljdgowcwuubkau (also used by marketing-agent, Edu, and AfterAllCare). The starter's own DB cyczlgdaocwueaacqxsh is paused and must not be restored. Only files in this repo may change. 'Hide' means hiding in code via filters/allow-lists, never deleting rows. Anything that seems to need a DB change goes under Out of scope.**

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do not apply SQL. Do not call Supabase. Do not restore `cyczlgdaocwueaacqxsh`. Do not edit `trumantool/marketing-agent`.

**Goal:** Hide marketing-agent templates and shared skills in this starter, remove template create/clone and the generic automations product, keep blogging and personal skill upload, and drop nav, dashboard cards, routes, and dead code that only exist for the removed surfaces.

**Write repo:** https://github.com/trumantool/NextJS-Supabase-Starter  
**Branch inspected:** `main` @ `545a5f6` (`Put the blog heading and posts before the sidebar on small screens. (#24)`)  
**Reference only:** `trumantool/marketing-agent` `main` @ `c03759e` (GitHub contents API). Plans read: `docs/plans/blog.md`, `docs/plans/blog-dashboard-menu.md`, `docs/plans/auto-blogging.md`, `docs/plans/ai-content-checker.md`, `docs/plans/task-manager-platform-agent.md`.

**Live rows:** Read-only lookup on `glplvrljdgowcwuubkau`, 2026-10-10 ~23:15 ET (SELECT / `information_schema` only). This plan did not re-query the database. Figures in the allow-list section come from that lookup.

---

## Decisions locked for the implementer

1. **Hide every database template.** All 12 `agent_templates` rows are marketing-agent recipes. The allow-list is by **slug**. The only allowed slug is the code builtin `starter-assistant`. Do not rename it until open question 1 is answered.
2. **Shared skill allow-list is empty.** No shared skill is linked to a General or Task Management template. Personal skills (`user_id` = the signed-in user) always stay visible so upload, import, and create keep working.
3. **Do not add a `website` or `app_key` column** on `agent_templates`, `agent_skills`, or `user_agents`. Those tables have no app column. Filtering is code-only.
4. **Existing `user_agents` cloned from hidden templates are hidden, not deleted.** See [Existing user agents](#existing-user-agents).
5. **There is no blog-post automation in this repo.** Remove the generic automations product. Do not port marketing-agent auto-blog.
6. **Keep `/todos` and `todo_list`.** Do not add a Task Management agent template until open question 2 is answered.
7. **Keep the public blog and authoring.** Dashboard/sidebar blog work from marketing-agent PR #150 waits on Truman's review of that draft. No migration either way.

---

## Allow-list

### Where it lives

Add one module, `nextjs/src/lib/starter-catalog-allowlist.ts`. UI, route handlers, and skill assignment all import it. Do not copy the id arrays into components.

Suggested shape:

```ts
export const ALLOWED_TEMPLATE_SLUGS = ['starter-assistant'] as const

/** Shared agent_skills.id values. Empty until Truman answers open question 3. */
export const ALLOWED_SHARED_SKILL_IDS: readonly string[] = []

export const HIDDEN_TEMPLATE_SLUGS = [ /* the 12 slugs below */ ] as const
export const HIDDEN_TEMPLATE_IDS = [ /* the 12 ids below */ ] as const
```

Helpers:

- `isAllowedTemplateSlug(slug)` — true only for `starter-assistant`.
- `isHiddenTemplate(id, slug)` — true when id or slug is in the 12.
- `isSharedSkillAllowed(id)` — true when `ALLOWED_SHARED_SKILL_IDS` contains that id. Empty list means no shared skill passes.
- `isSkillRowVisible(row, userId)` — true when `row.user_id === userId`, or when `row.user_id == null` and `isSharedSkillAllowed(row.id)`.
- `isUserAgentVisible(agent)` — false when `source_template_id` is one of the 12 ids, or when `source_template_id` is null and `source_template_name` equals one of the 12 template names. Otherwise true (blank / Untitled agents stay).

Filter in memory after the existing select. Do not add a SQL `website` predicate. Selects stay on columns this repo's `types.ts` already has (`id`, `user_id`, `skill_name`, …). The live table has `category_id` and `keywords`; `supabase/schema.sql` `agent_skills` does not. Do not require those columns.

`withBuiltinStarter()` in `nextjs/src/lib/agent-templates.ts` already injects `STARTER_TEMPLATE` when no row has slug `starter-assistant`. Keep that. The lookup found **no** `starter-assistant` row.

### Template identifiers

**Code builtin (keep):**

| Field | Value | Source |
|---|---|---|
| slug and builtin id | `starter-assistant` | `STARTER_TEMPLATE_SLUG` in `nextjs/src/lib/agent-templates.ts` |
| name | `Starter Assistant` | same file, `STARTER_TEMPLATE.name` |
| description | "A general-purpose assistant. Clone it, then attach skills…" | same object |
| `skill_ids` | `[]` | same object |
| status | `published` | same object |

No `INSERT` into `agent_templates` or `agent_skills` exists under `supabase/migrations/` or `supabase/schema.sql`.

**Chat "General" (keep, not a template row):**

- `nextjs/src/components/chat/AgentSwitcher.tsx` renders `<option value="">General</option>`.
- `GET /api/chats` (`nextjs/src/app/api/chats/route.ts`) treats a missing `agent-id` as `agent_id IS NULL`.
- `POST /api/chat` loads `skill_ids` only after it resolves a `user_agents` row. General chat uses the default system prompt in that route and does not attach catalog skills.

**Database templates (hide all).** Lookup 2026-10-10. None is named General or Task Management. None uses slug `starter-assistant`.

| id | slug | name | status |
|---|---|---|---|
| `ad6814e7-c3d5-403d-8f83-ba25c824194b` | `seo-agent` | SEO Agent | published |
| `6bf11c96-a85a-4c88-bbcf-5d364fef04fe` | `seo-agent-copy` | SEO Agent copy | draft |
| `c7e9bd02-6418-48e0-a9d4-b7c111fbc206` | `klaviyo-agent` | Klaviyo Agent | published |
| `6ea43467-ac9c-43c4-831d-af2962e5b9a8` | `video-gen-agent` | Video Gen Agent | published |
| `8b57e722-6e18-4862-aa5b-acf5cd39acd3` | `google-ads-analyst` | Google Ads Analyst | published |
| `a87a0010-04be-4efb-af1a-b2eec584b285` | `shopify-agent` | Shopify Agent | published |
| `0401be89-67c9-4f09-983f-305770b5a1ae` | `local-seo-agent` | Local SEO Agent | published |
| `a0d411a3-3bfa-413d-81c4-15fb77663a7b` | `wix-web-developer-agent` | Wix Web Developer Agent | published |
| `c4a8e1d0-6b27-4f3a-8e11-a10000000018` | `meta-ads-analyst` | Meta Ads Analyst | draft |
| `d5b9f2e1-7c38-4a4b-9f22-b20000000027` | `callrail-analyst` | CallRail Analyst | draft |
| `e6c0a3f2-8d49-4b5c-a033-c30000000035` | `paid-ads-analyst` | Paid Ads Analyst | draft |
| `7280af10-981b-41c3-981b-30b462b7a568` | `social-media-content-agent` | Flagship Social Media Content Agent | draft |

Marketing-agent migrations that insert four of these (reference only, do not copy): `supabase/migrations/20260911010000_seo_agent_agent_id.sql` (`seo-agent`), `20260917190000_klaviyo_agent_skills_template.sql` (`klaviyo-agent`), `20260924120000_video_gen_agent_skills_template.sql` (`video-gen-agent`), `20260926170000_shopify_agent_skills_template.sql` (`shopify-agent`). GitHub code search on marketing-agent `main` found `INSERT INTO public.agent_templates` in those four files only. The other eight rows exist in the shared database without a matching insert in that search.

### Skill identifiers

Lookup: **114** `agent_skills` rows, all shared (`user_id IS NULL`), **0** personal. Categories on the live table (not in starter `schema.sql`): seo 7, local-seo 11, klaviyo 7, video 16, shopify 14, wix 11, social 12, google-ads 7, meta-ads 7, callrail 6, paid-ads 4, paid-media 7, workflow 4, skill-authoring 1. None are linked to a General or Task Management template. There is no template-to-skill join table. Links are `skill_ids uuid[]` on `agent_templates` and `user_agents`.

**Default allow-list: empty.** Do not paste the 114 ids into the repo.

**Optional, only if open question 3 says yes.** Leave them commented above the empty array, not active:

| skill_name | id | category (live DB) |
|---|---|---|
| `goal-isolate` | `8a4982f8-2495-4f1a-aa3b-c40187754ace` | workflow |
| `evidence-before-after` | `58b4bf05-b075-4e4f-b879-9b55e0e8d54d` | workflow |
| `review-loop` | `fa81ce9e-526a-4bbe-a01e-3717dd8e5a22` | workflow |
| `ship-with-approval` | `c3f2da2a-e9cc-4f15-895e-bcef77fe499b` | workflow |
| `create-agent-skill` | `4e6048ca-49fd-45c2-8777-3c6ec0278baa` | skill-authoring |

Marketing-agent `docs/skills/authoring/create-agent-skill.md` says `create-agent-skill` must not be attached to product templates. If Truman allows it, it is a library skill, not a template attachment.

### Where filters apply

| Surface | File | Behavior |
|---|---|---|
| Template list API | `nextjs/src/app/api/agent-templates/route.ts` | After the select, drop hidden slugs/ids. Then `withBuiltinStarter`. `?status=all` does not reveal the 12. |
| Template catalog page | remove `nextjs/src/app/(dashboard)/agent-templates/page.tsx` and `AgentTemplateCatalog.tsx` | Users cannot open a clone gallery. Direct URL 404s because the route is gone. |
| Admin template CRUD | `nextjs/src/app/api/admin/agent-templates/route.ts`, `[id]/route.ts`, `AdminAgentTemplates.tsx` | Remove POST create, PATCH, DELETE, and the admin tab. Any leftover handler returns 404 for the 12 ids and does not write. |
| Clone | `POST /api/agents` in `nextjs/src/app/api/agents/route.ts`, `cloneTemplateToUserAgent` in `nextjs/src/lib/clone-user-agent.ts` | Reject `starter: true` and any `template_id` (including the 12 UUIDs and the slug `starter-assistant`). Keep `createBlankUserAgent` so a user can still make an untitled agent and attach personal skills. |
| Agent list | `GET /api/agents` | Return only `isUserAgentVisible` rows. |
| Agent by id | `nextjs/src/app/api/agents/[id]/route.ts` | 404 when the row is hidden. PATCH/DELETE of a hidden row 404s and does not update. |
| Chat switcher | `AgentSwitcher.tsx`, `ChatView.tsx` | Options are General plus visible user agents. Hidden clones are absent. |
| Chat turn | `nextjs/src/app/api/chat/route.ts` | If `agent_id` points at a hidden clone, return 403 and do not call `loadAgentSkills`. General (`agent_id` null) still runs. |
| Chat list | `nextjs/src/app/api/chats/route.ts` | Do not delete threads. A request whose `agent-id` is a hidden user-agent id returns an empty list (or 404). General (`agent_id IS NULL`) is unchanged. Opening `/chat/[id]` for a thread bound to a hidden agent shows the thread but does not execute a turn (403 above). |
| Skill list API | `nextjs/src/app/api/agent-skills/route.ts` | Filter with `isSkillRowVisible`. |
| Skill page | `nextjs/src/app/(dashboard)/agent-skills/page.tsx` plus `actions.ts` | Shared tab: allow-listed ids only (empty state today). Mine tab: `user_id` = current user. Keep upload, GitHub import, and create on **Mine**. |
| Client list | `listAgentSkills()` in `nextjs/src/lib/supabase/unified.ts` | Same visibility filter before `setSkills`, so a direct client list cannot paint the 114. |
| Pickers | `SkillPicker.tsx` callers: `AgentEditor.tsx`. `AutomationForm.tsx` goes away with automations. `AdminAgentTemplates.tsx` goes away with template admin. | Pass the filtered list only. |
| Attach on save | `assertSkillIdsVisible` in `nextjs/src/lib/agent-templates.ts` and `nextjs/src/lib/load-agent-skills.ts` | Reject a shared id that is not allow-listed, even if the client posts it. Own skills (`user_id` = caller) still pass. |
| Skill file preview / signed URL | `agent-skills/actions.ts` | Refuse to sign or preview a shared object whose id is not allow-listed. |

Direct URL `/agent-templates` and `/admin?tab=templates` must not render the 12. Removing the page and the tab is the direct-URL control. API 404s cover scripted access.

Admin "save as shared" (`writeShared` on the skills page) inserts `user_id` null. Those rows will not appear while the shared allow-list is empty. Leave the shared-write control out of the personal flow. Personal upload sets `user_id` and stays visible.

### Existing user agents

Lookup: **4** `user_agents` rows. Three are marketing clones: "Google Ads - ProVet Legal", "Klaviyo Agent - Truman Tool", "Local SEO - Ember Wood". One is "Untitled agent" with no template and 0 skills. The lookup grouped by name and did not print each row's uuid.

**Treatment (locked):** hide the three clones in every list, picker, and chat execution path, using `source_template_id` against the 12 ids and `source_template_name` against the 12 names (`supabase/schema.sql` columns on `user_agents`). Do not `DELETE` them. Do not clear `skill_ids`. Chats that reference them stay in the table (`chats.agent_id` is `ON DELETE CASCADE`; a delete would remove threads, so do not delete). The Untitled agent stays editable and can receive personal skills.

New blank agents remain allowed. New clones of the 12 are not.

---

## Current-state inventory

App root is `nextjs/`. Schema contract in git is `supabase/schema.sql` plus `supabase/migrations/`. The live shared database has columns and policies this repo does not define. Do not "fix" that with a migration.

### Pages

| Path | File | Keep? |
|---|---|---|
| `/` | `nextjs/src/app/(public)/page.tsx` | Keep. Update copy that advertises Automations and agent templates. |
| `/dashboard` | `nextjs/src/app/(dashboard)/dashboard/page.tsx` | Keep. Remove Templates and Automations cards. |
| `/documents`, `/documents/new`, `/documents/[id]` | `nextjs/src/app/(dashboard)/documents/**` | Keep. |
| `/storage` | `nextjs/src/app/(dashboard)/storage/page.tsx` | Keep. |
| `/todos` | `nextjs/src/app/(dashboard)/todos/page.tsx` | Keep. This is the Task Management UI in this repo. Table is `todo_list`. There is no `todo_categories` table in `schema.sql` (the live lookup mentioned that table; do not create it). |
| `/chat`, `/chat/[id]` | `nextjs/src/app/(dashboard)/chat/**` | Keep. General = no agent. |
| `/agents`, `/agents/[id]` | `nextjs/src/app/(dashboard)/agents/**` | Keep for visible agents. Remove "Browse templates" / "Use a template" links in `AgentsPage.tsx`. |
| `/agent-skills` | `nextjs/src/app/(dashboard)/agent-skills/**` | Keep, filtered. |
| `/agent-templates` | `nextjs/src/app/(dashboard)/agent-templates/page.tsx` | **Remove.** |
| `/automations`, `/automations/new`, `/automations/[id]` | `nextjs/src/app/(dashboard)/automations/**` | **Remove.** Not blog posting. |
| `/my-posts`, `/my-posts/new`, `/my-posts/[id]` | `nextjs/src/app/(dashboard)/my-posts/**` | Keep. |
| `/admin` | `nextjs/src/app/(dashboard)/admin/page.tsx` | Keep settings. Remove the templates tab (`AdminSettingsTabs.tsx` renders `AdminAgentTemplates`). |
| `/admin/blog` | `nextjs/src/app/(dashboard)/admin/blog/page.tsx` | Keep. Today it is moderation, not the #150 My Posts screen. |
| `/posts`, `/posts/[slug]`, category/tag/author | `nextjs/src/app/(public)/posts/**` | Keep. Public label is Blog. Route stays `/posts`. |
| `/posts/rss.xml` | `nextjs/src/app/(public)/posts/rss.xml/route.ts` | Keep. |
| `/contact`, `/terms`, `/privacy`, `/legal/**`, auth pages | existing | Keep. |

`nextjs/src/lib/supabase/middleware.ts` `protectedPaths` includes `/agent-templates` and `/automations`. Remove those entries when the routes are gone. Leave `/todos`, `/chat`, `/agents`, `/agent-skills`, `/my-posts`, `/admin`.

### Dashboard sidebar (`nextjs/src/components/AppLayout.tsx`)

Everyone, in order: Home `/dashboard`, Documents, My Files `/storage`, To Do `/todos`, Chat, Agents, Skills `/agent-skills`, Templates `/agent-templates`, Automations `/automations`, Posts `/my-posts`, User Settings.

Admins only, under Admin: Admin Settings `/admin`, Blog `/admin/blog`, Agent Templates `/admin?tab=templates`.

There is no Blog item that opens the public blog in a new tab. There is no Blog submenu. There is no "Post Automations" item.

### Public header

`MenuNav.tsx` and `MobileMenu.tsx`: Features, How it works, Pricing, TOS dropdown, **Blog** (`href="/posts"`), Contact. There is no Services menu and no Services dropdown. Blog is already a top-level item. Do not move it inside TOS.

Truman's sites rule (marketing-agent `nextjs/src/lib/services/nav.ts`: `BLOG_NAV_ITEM = { href: '/blog', label: 'Blog' }` with the comment to place it immediately after Services): if this starter later grows a Services menu, Blog stays a sibling **after** Services, never a child. This repo's public blog path is `/posts`, not `/blog`. Do not rename it in this cleanup.

### API routes

| Route | Action |
|---|---|
| `api/agent-templates/route.ts` | Filter, or delete if nothing calls it after the page is gone. Prefer filter-then-404 the route if unused. |
| `api/admin/agent-templates/route.ts`, `[id]/route.ts` | Remove. |
| `api/agents/route.ts`, `api/agents/[id]/route.ts` | Keep. Strip clone. Hide marketing clones. |
| `api/agent-skills/route.ts` | Keep. Filter. |
| `api/chat/route.ts`, `api/chats/route.ts`, `api/chats/[id]/route.ts` | Keep. 403 hidden agents. |
| `api/automations/route.ts`, `api/automations/[id]/route.ts`, `[id]/run`, `[id]/runs` | **Remove.** |
| `api/cron/automations/route.ts`, `api/workers/automations/route.ts` | **Remove.** |
| `api/posts/**`, `api/tags/route.ts` | Keep. |
| `api/admin/settings/route.ts`, `api/user/**`, `api/stripe/**`, `api/privacy`, `api/terms`, `api/auth/callback` | Keep. |
| `documents/api/**` | Keep. |

### `vercel.json` crons

`nextjs/vercel.json` today:

```json
{ "path": "/api/cron/automations", "schedule": "17 9 * * *" }
{ "path": "/api/workers/automations", "schedule": "47 9 * * *" }
```

Both are daily (Vercel Hobby allows daily crons). Both drive the generic OpenRouter automation queue (`CRON_SECRET` via `nextjs/src/lib/cron-auth.ts`). Neither posts a blog. **Delete both entries** when the routes are deleted. Do not add an hourly cron.

Marketing-agent `main` `nextjs/vercel.json` (reference): `/api/cron/automations` and `/api/workers/automations` at `0 12 * * *`, plus `/api/cron/content-checks` at `0 13 * * *`. No auto-blog cron on that `main`. Draft #148's hourly cron is not on `main` and needs Vercel Pro. Do not add it.

### Env vars (`nextjs/.env.template`, `nextjs/.env.example`)

| Name | Action |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PRIVATE_SUPABASE_SERVICE_KEY` | Keep. |
| `OPENROUTER_API_KEY` | Keep (chat, documents). |
| `CRON_SECRET` | **Remove** from the template and from README text that says automations require it. Only the two cron routes read it. |
| `POSTS_WEBSITE` | Keep. Allowed values in code: `edu`, `marketing-agent`, `afterallcare` (`nextjs/src/lib/posts.ts` `POST_WEBSITES`). No default. |
| `NEXT_PUBLIC_SITE_ORIGIN`, `ADMIN_SETTINGS_APP_KEY`, `NEXT_PUBLIC_PRODUCTNAME`, theme, SSO, Google tag, tier vars | Keep. |
| Stripe vars | Keep. Used by `api/stripe/**`. |
| Composio / Treg / `OPENROUTER_API_KEY_REACHTHEMAI` | Already documented as "do not set". No runtime reader in `nextjs/src`. Leave the warning. |

`package.json` depends on `@paddle/paddle-js` and `@paddle/paddle-node-sdk`. No import under `nextjs/src`. Remove those two dependencies in the dead-code pass.

### What "General" and "Task Management" are in this repo

| Phrase | What the code and the lookup actually are |
|---|---|
| General agent | Not a row. Chat option `value=""`. `chats.agent_id IS NULL`. |
| Starter Assistant | Code constant `starter-assistant`, `skill_ids: []`, injected by `withBuiltinStarter()` when the catalog has no such slug. |
| Task Management agent | Not a row and not in the starter chat switcher. The todos page is `/todos` on `todo_list`. |
| Task Manager platform agent | Marketing-agent only: `PLATFORM_AGENT_TASK_MANAGER = 'task-manager'` in `nextjs/src/lib/platform-agents.ts`, product id `platform:task-manager`, column `chats.platform_agent_key`. Starter `chats` has no `platform_agent_key`. Adding that column is out of scope. |

---

## Blogging: ported vs missing

Starter public blog is `/posts` (label Blog). Marketing-agent public blog is `/blog`. Compare behavior, not the path string.

### Already in the starter (keep)

From `main` through #24, verified in tree:

- Posts contract and authoring: `/my-posts`, `/my-posts/new`, `/my-posts/[id]`, `PostEditor.tsx`, `api/posts/route.ts`, `api/posts/[id]/route.ts`.
- `posts.body_doc` in `supabase/schema.sql` and migration `20261009140100_posts_body_doc.sql`. `posts-store.ts` falls back when the column is missing.
- Public roll: `/posts` with covers, filters, pagination (`blog-roll.ts`, `PublishedPostList.tsx`, `PostsPagination.tsx`, `SearchForm.tsx`). #24 puts the heading and list before the sidebar on small screens.
- Taxonomy routes: `/posts/category/[slug]`, `/posts/tag/[slug]`, `/posts/author/[slug]`.
- Tables in starter migrations: `blog_categories`, `blog_tags`, `post_categories`, `post_tags`, `blog_author_profiles` (`20261009140200`), `blog_revisions` (`20261009140300`), `blog_media` (`20261009140400`), `blog_comments` (`20261009140500`), `newsletter_subscribers` (`20261009140600`).
- Author profile **in starter SQL** columns: `user_id`, `slug`, `display_name`, `bio`, `avatar_url`. No `linkedin_url`, `title`, `company`, or `location` in that `CREATE TABLE`.
- `blog-taxonomy.ts` tries author selects that include `linkedin_url`, `title`, `company`, `location`, then narrower selects, and logs a schema gap. That is a read fallback, not a migration.
- `posts-store.ts` tries `cover_image_alt`, then retries without it. `PublishedPostList.tsx` and the slug page use it when present. `posts` in `schema.sql` has `cover_image_url` and does **not** define `cover_image_alt`.
- RSS, sitemap, Open Graph image route, newsletter and comment APIs, `blog-seo.ts` JSON-LD from title/summary/cover URL.
- Admin page `/admin/blog`: list title and status, View, Unpublish, **hard** `delete()` in `admin/blog/actions.ts` `deleteBlogPost`, comment moderation, newsletter subscriber list. Sidebar link "Blog" → `/admin/blog` for admins only. Authors use "Posts" → `/my-posts`.
- TipTap tables are dependencies in `package.json` (`@tiptap/extension-table*`). Confirm during the blog pass whether `PostEditor` actually mounts them; do not remove the table extensions if the editor uses them.

### On marketing-agent `main`, not in this starter

| Piece | marketing-agent | starter |
|---|---|---|
| Public path | `/blog` | `/posts` |
| `BLOG_WEBSITE` constant | `nextjs/src/lib/blog/constants.ts` hardcodes `'marketing-agent'` and does not read `POSTS_WEBSITE` | `requirePostWebsite(process.env.POSTS_WEBSITE)` |
| YouTube embeds | `nextjs/src/lib/blog/youtube.ts`, `youtube-extension.tsx` | No youtube module under `nextjs/src` |
| `seo_title`, `meta_description`, `og_image_url` | migration `20261009180000_posts_seo_fields.sql` | Not in `schema.sql` or `types.ts` `posts` |
| `deleted_at` | specified in `docs/plans/blog-dashboard-menu.md` (PR #150, draft) | Not in `schema.sql`. Admin delete is a hard `DELETE`. |
| `posts_block_author_id_change` | migration `20261010120000_posts_block_author_id_change.sql` | Not in starter migrations |
| Author `linkedin_url`, `title`, `company`, `location` | migrations `20261009191000`, `20261009200000` | Not in starter `CREATE TABLE`. Runtime fallback only. |
| YouTube Data API key admin setting | migration `20261010170000` | Not present |
| AI content checker | `nextjs/src/lib/content-check/**`, cron `/api/cron/content-checks`, migrations `20261009210000`–`20261010153000` | Not present |
| Auto-blog | `docs/plans/auto-blogging.md`, draft PR #148. Tables `auto_blog_configs`, `auto_blog_topics`, `auto_blog_usage` are **not** on the shared DB (CoS). | Not present |
| Admin sidebar #150 | Not on marketing-agent `main` yet. Spec: non-admins get a new-tab Blog link; admins get a Blog submenu (My Posts, and Post Automations only after #148). | Not present. See below. |

### Shared DB vs this repo's schema (CoS,  not re-queried here)

Already on `glplvrljdgowcwuubkau`, per Truman's Chief of Staff: `posts.body_doc`, `cover_image_alt`, `seo_title`, `meta_description`, `og_image_url`, `deleted_at`; restrictive soft-delete SELECT policies; no authenticated hard delete of blog posts; `posts_block_author_id_change`; anon blog read scoped to `website = 'marketing-agent'`; from #115, `blog_author_profiles` (including linkedin/title/company/location), revisions, `blog-media` bucket, comments, `newsletter_subscribers`; `edu.is_admin()` for `authenticated` and `service_role` only.

Not applied: `auto_blog_configs`, `auto_blog_topics` (pgvector), `auto_blog_usage`, firecrawl key row, `seo_blog_post_skill` row.

**This repo's SQL does not match that live policy set.** Starter `posts_select_published_blog` (`supabase/schema.sql`) allows anon and authenticated to read any published blog with `published_at <= now()` and does **not** filter `website`. The comment above it says a fresh starter database is not the shared project. Starter admin checks call `authenticative.is_admin()`, and a migration comment says the starter has no `edu` schema.

**What that means for `POSTS_WEBSITE`:** app code filters `.eq('website', POSTS_WEBSITE)` on every post read and sets it on writes. On the shared database, anon RLS (live, not this repo's file) only returns `website = 'marketing-agent'`. A deploy with `POSTS_WEBSITE=edu` or `afterallcare` can write or read as the author/admin JWT and still get **empty anonymous public pages**, because the live anon policy will not return those rows. This plan does not change that policy. For the live starter, set `POSTS_WEBSITE=marketing-agent` if anonymous `/posts` must show rows. A fresh clone that applied only this repo's migrations would not have that website restriction.

**Recommendation for columns the starter SQL does not define** (`seo_title`, `meta_description`, `og_image_url`, `deleted_at`, and the author columns above; `cover_image_alt` is already optional in code):

- Do not add migrations so a fresh clone "catches up."
- Do not make those columns required.
- New reads follow the existing `posts-store.ts` / `blog-taxonomy.ts` pattern: try the wider column list, on a missing-column error retry without it and log `logBlogSchemaGap`.
- Do not switch `deleteBlogPost` to `deleted_at` in the removal PR. Soft delete is part of the #150 port, which is gated below. On the shared DB a hard `DELETE` may already fail (CoS: no authenticated hard delete). Until #150 is approved, leave the current delete action, and do not paper over a failure by editing policies. Record it in the PR test notes if an admin delete errors.
- `body_doc` **is** in starter SQL. Keep using it.

### Admin sidebar and blog dashboard (#150)

`docs/plans/blog-dashboard-menu.md` on marketing-agent `main` is the spec Truman wants rolled out. PR **#150 is a draft awaiting Truman's review.** Do not implement that spec until he accepts it. When he does, port the **design** into this repo without a migration and without copying marketing-agent's `/blog` path:

- Non-admins: sidebar Blog opens `/posts` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). They already have "Posts" → `/my-posts`. The #150 spec replaces the non-admin destination with the public blog. Do that only in the #150 phase, and do not remove `/my-posts` (authors still need the URL).
- Admins: a Blog submenu. Child "My Posts" labels the existing `/admin/blog` list (do not rename the route onto `/my-posts`). Cover, short preview, Edit, Delete via `AlertDialog` (the component exists at `nextjs/src/components/ui/alert-dialog.tsx`). Delete confirm names the title.
- "Post Automations" → `/automations?type=blog` is **#148**. Do not add that menu item. #148 is out of scope.
- Editor: Visual (current TipTap) and HTML tabs, Back to the list the user came from, no horizontal overflow at 375px. These are code-only if they round-trip through `body_doc` and `body`, which the starter already stores.
- Soft delete (`deleted_at`) is a shared-DB column this repo's schema does not create. Implement it only in the #150 phase, only with the missing-column fallback, and only after Truman accepts #150. Do not add the column.

Remove the Admin submenu item "Agent Templates" in the removal phases. That does not wait on #150.

---

## Automations

`nextjs/src/lib/automations.ts` is a generic scheduler: name, prompt, frequency, timezone, model, `skill_ids`, optional `agent_id`. Frequencies include once, daily, weekdays, weekly, monthly, yearly. No `type=blog`, no `auto_blog`, no post insert.

Worker: `nextjs/src/lib/automation-worker.ts`. UI: `components/automations/AutomationForm.tsx`, `AutomationList.tsx`, `AutomationDetail.tsx`.

**Keep set for "blog post automations": none.** Nothing in this repo creates a blog post on a cron. Creating a post is `POST /api/posts` and `/my-posts/new`, which stay.

**Remove** the automations pages, API routes, cron routes, worker, schedule helper, and components. Keep `load-agent-skills.ts`, `cron-auth.ts` only if something else imports it after the cron routes are gone; if the only callers were the two automation routes, delete `cron-auth.ts` too. Keep `llm-usage.ts` for chat. `llm_turn_rates.automation_run_id` stays in SQL (do not migrate). Chat recording must still work when `automation_run_id` is null.

Do not port `docs/plans/auto-blogging.md` or draft #148. That stack needs `auto_blog_*` tables, pgvector topics, a firecrawl key row, and an `seo_blog_post_skill` row, none of which are on the shared database, plus an hourly cron Hobby will not run.

---

## Other marketing-agent-only code

| Item | Verdict | Why |
|---|---|---|
| 12 DB templates (SEO, Klaviyo, Video, Google Ads, Shopify, Local SEO, Wix, Meta Ads, CallRail, Paid Ads, Social) | **Hide** | They are the marketing catalog. No app column to scope them. |
| 114 shared skills in those categories | **Hide** | Same. Empty allow-list. |
| Three cloned `user_agents` | **Hide** | Clones of hidden templates. Rows stay. |
| Untitled `user_agents` row | **Keep** | No template, no skills. |
| Builtin `starter-assistant` | **Keep** | Only non-marketing template. Code-only. |
| General chat (`agent_id` null) | **Keep** | Not marketing. |
| `/todos` + `todo_list` | **Keep** | This repo's task UI. |
| Personal skill upload / GitHub import | **Keep** | `user_id` = caller. |
| Template gallery, admin template editor, clone | **Remove** | Users must not create or clone templates. |
| Generic automations + crons + `CRON_SECRET` | **Remove** | Not blog posting. |
| Composio, Google Ads runtime, brand profiles, Klaviyo/Shopify/Wix tools | **Already absent** from `nextjs/src` (comments and env warnings only). Do not add them. |
| `required_toolkits` / `mcp_config` columns | **Keep the columns** (no DDL). Leave values unused. Do not build a toolkit runner. |
| `POST_WEBSITES` including `marketing-agent` | **Keep** | Shared `posts.website` check. The live anon policy is why the value matters. |
| Social profile URLs on `user_data` (`social-profile.ts`) | **Keep** | User settings, not an ads product. |
| Stripe billing | **Keep** | Starter billing routes. |
| Paddle packages | **Remove from package.json** | No `src` import. |
| Documents, files, auth/MFA, admin site settings, BYOK | **Keep** | Shared starter surface. |
| `supabase-expo-template/`, `README_MOBILE.md` | **Leave** unless a grep shows links to `/automations` or `/agent-templates`. Do not expand Expo. |
| AI content checker, YouTube Data API setting, auto-blog | **Do not port** | Missing here; auto-blog needs DB objects that are not applied. YouTube embed code may be ported later only if it does not need a new setting row. Not this cleanup. |

---

## Phased tasks

### Phase 1 — Allow-list module

Files: `nextjs/src/lib/starter-catalog-allowlist.ts` (new), plus a small node test next to the other `src/lib/*.test.ts` files (add it to the `test` script in `nextjs/package.json`).

- [ ] Constants match the tables in this plan. `ALLOWED_SHARED_SKILL_IDS` is empty. Optional five ids are comments, not members.
- [ ] Unit tests: each of the 12 slugs is hidden; `starter-assistant` is allowed; a shared skill id is hidden; a row with `user_id` equal to the caller is visible; a `user_agents` row whose `source_template_id` is `8b57e722-6e18-4862-aa5b-acf5cd39acd3` is hidden; a row with null `source_template_id` and empty `source_template_name` is visible.

**Done when** the tests pass and no other behavior has changed.

### Phase 2 — Hide templates and remove create/clone

Files:

- `nextjs/src/app/api/agent-templates/route.ts`
- `nextjs/src/app/api/admin/agent-templates/route.ts`
- `nextjs/src/app/api/admin/agent-templates/[id]/route.ts`
- `nextjs/src/app/api/agents/route.ts`
- `nextjs/src/app/api/agents/[id]/route.ts`
- `nextjs/src/lib/clone-user-agent.ts` (delete clone export if unused; keep blank create)
- `nextjs/src/lib/agent-template-write.ts` (delete if unused)
- `nextjs/src/components/agents/AgentTemplateCatalog.tsx`
- `nextjs/src/components/agents/AdminAgentTemplates.tsx`
- `nextjs/src/components/agents/AgentsPage.tsx`
- `nextjs/src/app/(dashboard)/agent-templates/page.tsx` and `loading.tsx`
- `nextjs/src/components/AdminSettingsTabs.tsx`
- `nextjs/src/components/AppLayout.tsx`
- `nextjs/src/lib/supabase/middleware.ts`
- `nextjs/src/app/(dashboard)/dashboard/page.tsx` (templates card)
- `nextjs/src/app/(public)/page.tsx` (template/automation sentences that would be false)

- [ ] `GET /api/agent-templates` returns at most the builtin starter (and a real row only if its slug is `starter-assistant`).
- [ ] `POST /api/agents` with `template_id` set to any of the 12 ids returns 400 or 404 and inserts nothing.
- [ ] `POST /api/agents` with `starter: true` does not clone.
- [ ] `POST /api/agents` with a name and no template still creates a blank agent.
- [ ] `GET /api/agents` omits the three marketing clones and includes Untitled.
- [ ] `/agent-templates` is gone. Sidebar has no Templates link. Admin has no Agent Templates item.
- [ ] `/agents` has no link to the template gallery.
- [ ] General chat still sends a message.

**Done when** a signed-in user cannot create or clone a template, the 12 recipes are not listed, and General chat still completes a turn.

### Phase 3 — Filter skills, keep personal create

Files:

- `nextjs/src/app/api/agent-skills/route.ts`
- `nextjs/src/app/(dashboard)/agent-skills/page.tsx`
- `nextjs/src/app/(dashboard)/agent-skills/actions.ts`
- `nextjs/src/lib/supabase/unified.ts` (`listAgentSkills`)
- `nextjs/src/lib/agent-templates.ts` (`assertSkillIdsVisible`)
- `nextjs/src/lib/load-agent-skills.ts`
- `nextjs/src/components/agents/AgentEditor.tsx`
- `nextjs/src/components/agents/SkillPicker.tsx` (only if it needs an empty-state prop; do not special-case marketing names)

- [ ] Shared list is empty with the default allow-list.
- [ ] A skill inserted with the caller's `user_id` appears on Mine and in the picker.
- [ ] Upload and GitHub import on Mine still create that row (no schema change).
- [ ] Saving an agent with a shared id from the 114 returns an error and does not persist that id.
- [ ] Preview/signed URL for a non-allow-listed shared skill is rejected.
- [ ] General chat does not start loading those shared files.

**Done when** the skills page offers upload/import/create for the current user and does not list the marketing catalog.

### Phase 4 — Remove automations

Files:

- `nextjs/src/app/(dashboard)/automations/**`
- `nextjs/src/components/automations/**`
- `nextjs/src/app/api/automations/**`
- `nextjs/src/app/api/cron/automations/route.ts`
- `nextjs/src/app/api/workers/automations/route.ts`
- `nextjs/src/lib/automations.ts`
- `nextjs/src/lib/automation-schedule.ts`
- `nextjs/src/lib/automation-worker.ts`
- `nextjs/vercel.json`
- `nextjs/src/lib/cron-auth.ts` if unused
- `nextjs/src/lib/supabase/middleware.ts`
- `nextjs/src/components/AppLayout.tsx`
- `nextjs/src/app/(dashboard)/dashboard/page.tsx`
- `nextjs/.env.template`, `nextjs/.env.example`, `nextjs/README.md`, root `README.md` (only sentences that tell a fork to set `CRON_SECRET` or to use Automations)

- [ ] No route answers `/automations` or `/api/automations`.
- [ ] `vercel.json` has no cron entries.
- [ ] Sidebar and dashboard have no Automations link.
- [ ] `/my-posts/new` still creates a draft post (blog authoring, not an automation).
- [ ] Chat and documents still call OpenRouter.

**Done when** the generic scheduler is gone and blog authoring still works.

### Phase 5 — Dashboard, nav, dead code

- [ ] Dashboard cards: no Templates, no Automations, no other link to a removed path. Remaining cards still match live routes (Documents, Files, To Do, Chat, Agents, Skills, User Settings, Admin for admins). Posts can stay off the dashboard until Phase 6; do not add a card that 404s.
- [ ] Homepage feature list and the "how it works" steps no longer promise Automations or a template catalog.
- [ ] Grep `nextjs/src` for `/agent-templates`, `/automations`, `CRON_SECRET`, `cloneTemplateToUserAgent`, `AdminAgentTemplates`. Each hit is either deleted or a comment that states the feature is gone.
- [ ] Remove `@paddle/paddle-js` and `@paddle/paddle-node-sdk` from `nextjs/package.json` and the lockfile if grep still shows no source import.
- [ ] Do not delete `todo_list`, chat, documents, posts, or personal skills code.

**Done when** `rg` over `nextjs/src` finds no user-facing link to a removed page.

### Phase 6 — Blog dashboard port (blocked on Truman accepting marketing-agent PR #150)

Do not start this phase in the same PR as Phases 1–5 unless Truman has accepted #150.

Files (when unblocked): `AppLayout.tsx`, `dashboard/page.tsx`, `admin/blog/page.tsx`, `admin/blog/actions.ts`, `components/posts/PostEditor.tsx`, `my-posts` editor page. Public `MenuNav.tsx` / `MobileMenu.tsx`: do not put Blog inside a dropdown.

- [ ] Non-admin sidebar Blog opens `/posts` in a new tab.
- [ ] Admin Blog submenu: My Posts → `/admin/blog`. No Post Automations child.
- [ ] List shows cover and a short text preview, Edit, and Delete. Delete uses `AlertDialog` and includes the title.
- [ ] If soft delete is included, it updates `deleted_at` only, with a missing-column fallback, and it does not add a migration. If Truman skips soft delete, leave the current delete action and document the shared-DB hard-delete failure.
- [ ] Editor: Visual and HTML edit the same `body_doc` / `body`. Back returns to `/admin/blog` or `/my-posts` depending on which screen opened the editor. Layout does not overflow at 375px width.
- [ ] Public header Blog stays a top-level link to `/posts`.

**Done when** the #150 behavior above is true for an admin and a non-admin, and `supabase/` has no new file.

---

## Risks

| Risk | What to do |
|---|---|
| General chat has no `skill_ids`. "Assign skills to the General agent" cannot be done on the null-agent path. | Skills attach on a visible `user_agents` row (`AgentEditor`). Do not invent a skill injection for `agent_id` null unless question 1 says General means a real agent row. |
| Hiding clones does not stop a crafted `POST /api/chat` body. | Phase 2 checks `isUserAgentVisible` on the server before `loadAgentSkills`. |
| `chats.agent_id` `ON DELETE CASCADE` | Do not delete `user_agents` rows. |
| `assertSkillIdsVisible` today allows any shared skill (`user_id` null) the caller can read. RLS on the shared DB lets every signed-in user read shared skills. | The new check is application code. RLS stays as it is. |
| Empty shared allow-list hides a skill an Untitled agent already stored. Lookup says that row has 0 skills. The three clones are hidden entirely, so their `skill_ids` are not executed. | Re-check `skill_ids` on visible agents in the manual pass. |
| Admin hard delete of a post may fail on the shared DB (CoS: no authenticated hard delete). | Do not change policies. Do not switch to `deleted_at` until Phase 6. |
| Anon public blog empty when `POSTS_WEBSITE` is not `marketing-agent` | Document it. Do not edit `posts_select_published_blog` in the live project. |
| `edu.is_admin()` vs `authenticative.is_admin()` | Starter code and starter SQL use `authenticative`. The live project uses `edu.is_admin()` for blog policies (CoS). Do not replace functions. |
| Removing automations while chat imports a shared helper | Delete automation modules only after TypeScript shows no remaining imports. Keep `load-agent-skills.ts`. |
| `withBuiltinStarter` uses `id: 'starter-assistant'`, which is not a UUID. Clone already special-cases that slug. | After clone is removed, nothing should POST that id to `agent_templates`. |
| Task tools (`chat-task-tools.ts` on marketing-agent) | Not in this repo. Porting them plus `platform_agent_key` is a schema change. Out of scope until question 2, and the column itself stays out of scope. |
| Hobby cron | After Phase 4 there is no cron. Do not add one for auto-blog. |

---

## Verification

From `nextjs/`:

- [ ] `npm test` (script lists `src/lib/*.test.ts`; include the new allow-list test).
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

There is no `typecheck` script. `tsc` is the typecheck.

Manual, against the **already running** shared project. Do not restore the paused project. Do not run SQL.

**Non-admin**

- [ ] Sidebar: no Templates, no Automations. To Do, Chat, Agents, Skills, Posts still open.
- [ ] `/agent-templates` and `/automations` 404.
- [ ] Chat "General" sends a message.
- [ ] Agents list does not show Google Ads - ProVet Legal, Klaviyo Agent - Truman Tool, or Local SEO - Ember Wood. Untitled (or a new blank agent) opens.
- [ ] Skills: shared catalog empty; upload a small `.md` on Mine; it appears; attach it to the blank agent; chat as that agent still responds.
- [ ] Public Blog in the header goes to `/posts` and is not inside a dropdown.
- [ ] `/my-posts/new` saves a draft.

**Admin**

- [ ] Admin submenu has no Agent Templates. Blog still opens `/admin/blog`.
- [ ] Admin settings save still works (site title or similar non-secret field).
- [ ] `/admin/blog` still lists this site's posts (`POSTS_WEBSITE`). Do not delete a real post as the test. Unpublish is enough if a draft exists; otherwise stop at "list renders".
- [ ] Dashboard has no card whose href 404s.

Phase 6 checks (only after #150 is accepted): non-admin Blog opens `/posts` in a new tab; admin My Posts shows cover, preview, Edit, AlertDialog delete; editor Back and Visual/HTML; 375px width has no sideways scroll.

---

## Out of scope

- Any migration, `schema.sql` edit, RLS/policy change, seed, row delete, or restore of `cyczlgdaocwueaacqxsh`.
- A `website` / `app_key` column on `agent_templates`, `agent_skills`, or `user_agents`.
- `chats.platform_agent_key` and the marketing-agent Task Manager virtual agent.
- `todo_categories` (live lookup named it; starter SQL has `todo_list` only).
- Deleting or archiving the 12 templates, the 114 skills, the 3 clones, or their storage objects.
- Porting auto-blog (#141–#148), `auto_blog_*` tables, pgvector, firecrawl key, `seo_blog_post_skill`, or an hourly cron.
- Porting the AI content checker and `/api/cron/content-checks`.
- Adding Post Automations to the sidebar.
- Changing anon blog SELECT to include `edu` or `afterallcare`.
- Renaming `/posts` to `/blog`.
- Composio, Google Ads, Meta Ads, Klaviyo, Shopify, Wix, CallRail, Semrush, or brand profiles.
- Writing to `trumantool/marketing-agent`.
- Implementing Phase 6 before Truman accepts PR #150.

---

## Open questions for Truman

1. **What is the "General agent"?** The null-agent chat (`AgentSwitcher` value `""`), the code template `starter-assistant` ("Starter Assistant", `skill_ids: []`), or both? This plan keeps both, does not rename `starter-assistant`, and does not clone it. Say if the display name should become "General".
2. **What is the "Task Management agent"?** A new code-defined builtin (slug such as `task-management`) with task tools, or only the existing `/todos` page on `todo_list`? This plan keeps `/todos` only. A platform agent that needs `chats.platform_agent_key` cannot ship in this code-only pass.
3. **Which shared skills, if any, go on the allow-list?** Default is none. The five optional ids (goal-isolate, evidence-before-after, review-loop, ship-with-approval, create-agent-skill) stay commented until you say yes.

Related, not blocking Phases 1–5:

4. Confirm the locked hide rule for the three existing marketing `user_agents` clones (hidden in UI and chat, rows left in place) and that Untitled stays.
5. For the live starter, is `POSTS_WEBSITE` `marketing-agent`? Anonymous `/posts` on the shared database only returns that website.
6. Has PR #150 been accepted, and should Phase 6 use soft delete (`deleted_at`, already on the shared table, absent from this repo's schema) or leave hard delete as it is?

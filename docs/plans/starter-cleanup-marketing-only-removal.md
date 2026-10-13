# Starter cleanup — remove marketing-agent-only code

**CODE-ONLY. NO DATABASE CHANGES OF ANY KIND: no migrations, no SQL, no RLS/policy edits, no seed or row deletes, no restores, no new migration files. The live starter runs on the shared Supabase glplvrljdgowcwuubkau (also used by marketing-agent, Edu, and AfterAllCare). The starter's own DB cyczlgdaocwueaacqxsh is paused and must not be restored. Only files in this repo may change. 'Hide' means hiding in code via filters/allow-lists, never deleting rows. Anything that seems to need a DB change goes under Out of scope.**

## Changelog

### 2026-10-10 rev 2

Truman answered the rev 1 open questions. Chief of Staff then split the blog port.

- The code builtin `starter-assistant` is renamed **General** (the General agent). Plain chat with `chats.agent_id IS NULL` stays the general default as well.
- **Task Management** is a second code-defined agent. Its skills are repo files. None of the 114 shared `agent_skills` rows are task skills, and this plan does not insert any. Selection uses a per-user `user_agents` row (`defaults.builtinKey`) because `chats.agent_id` is a uuid foreign key and `chats` has no metadata column. See [How Task Management is selected](#how-task-management-is-selected).
- Shared skills on the allow-list are those built-in files only. The 114 database skills stay hidden. Users can still upload skills and assign them to both agents through `user_agents.skill_ids`.
- Generic non-blog automations go away. Blog automation stays. **Phase A** is the #150 blog dashboard and can ship now (`posts.deleted_at` is already on the shared database). **Phase B** is the #141–#148 auto-blog stack plus the Post Automations sidebar item. Phase B waits until Chief of Staff confirms the `auto_blog_*` migrations are live and Truman decides on Vercel Pro for the hourly cron. The starter applies nothing.
- Dashboard and nav drop links to removed pages, add the Task Management agent, and keep blog entries. Blog stays a top-level header item.

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do not apply SQL. Do not call Supabase. Do not restore `cyczlgdaocwueaacqxsh`. Do not edit `trumantool/marketing-agent`. Do not start Phase B until both gates in that phase are true.

**Goal:** Hide the marketing-agent template and skill catalog, ship two code-defined agents (General and Task Management), remove template create/clone and the generic automations product, keep personal skill upload, and port the marketing-agent blog. Phase A (dashboard) can land now. Phase B (auto-blog) waits on the shared database and on Vercel Pro.

**Write repo:** https://github.com/trumantool/NextJS-Supabase-Starter  
**Branch inspected:** `main` @ `545a5f6` (`Put the blog heading and posts before the sidebar on small screens. (#24)`)  
**Reference only:** `trumantool/marketing-agent` `main` (GitHub contents API). Plans read: `docs/plans/blog.md`, `docs/plans/blog-dashboard-menu.md`, `docs/plans/auto-blogging.md`, `docs/plans/ai-content-checker.md`, `docs/plans/task-manager-platform-agent.md`.

**Live rows:** Read-only lookup on `glplvrljdgowcwuubkau`, 2026-10-10 ~23:15 ET (SELECT / `information_schema` only). This plan did not re-query the database. Figures in the allow-list section come from that lookup. Rev 2 did not re-query.

A user action that inserts a row through an existing table (`user_agents` when someone selects a builtin agent, `posts` when someone writes a post) is the app's current write path. It is not a migration, seed, or policy edit. Do not add columns, policies, or migration files to make that insert possible.

---

## Decisions locked for the implementer

1. **Hide every database template.** All 12 `agent_templates` rows are marketing-agent recipes. Allow by slug. The only code template slug is `general` (renamed from `starter-assistant`). There is no `starter-assistant` row in the lookup, so the slug change is code-only.
2. **Two code agents, plus null chat.** The General agent is the renamed builtin. Plain chat (`agent_id IS NULL`) stays the general default and does not load catalog skills. Task Management is the second builtin. Neither is an `agent_templates` row.
3. **Shared database skills stay hidden.** `ALLOWED_SHARED_SKILL_IDS` is empty. The skills UI shows the Task Management markdown files from the repo. Personal skills (`user_id` = the signed-in user) stay visible.
4. **Do not add a `website` or `app_key` column** on `agent_templates`, `agent_skills`, or `user_agents`. Filtering is code-only.
5. **Existing `user_agents` cloned from hidden templates are hidden, not deleted.** See [Existing user agents](#existing-user-agents).
6. **Remove the generic automations product. Keep blog automation.** The two daily crons in `nextjs/vercel.json` enqueue that generic queue. Auto-blog does not use them (`next_run_at` stays null; a separate hourly route claims slots). Delete those two cron entries with the generic product. Keep `cron-auth.ts`, `CRON_SECRET`, and the worker modules Phase B will call. Do not add `0 * * * *` until Phase B is unblocked.
7. **Blog port is two phases.** Phase A (#150 dashboard, phases 1–6) ships first. Its only migration, `posts.deleted_at`, is already on the shared database. Phase B (#141–#148, including Post Automations) waits for Chief of Staff and for Truman's Vercel Pro decision. This repo applies no blog migration.
8. **Keep `/todos` and `todo_list`.** Task Management teaches that table. Do not create `todo_categories`. Do not add `chats.platform_agent_key`.

---

## Allow-list

### Where it lives

Add one module, `nextjs/src/lib/starter-catalog-allowlist.ts`. UI, route handlers, and skill assignment all import it. Do not copy the id arrays into components.

```ts
export const GENERAL_BUILTIN_KEY = 'general' as const
export const TASK_MANAGEMENT_BUILTIN_KEY = 'task-management' as const
export const BUILTIN_AGENT_KEYS = [GENERAL_BUILTIN_KEY, TASK_MANAGEMENT_BUILTIN_KEY] as const

/** Database agent_skills.id values. Empty: the 114 shared rows stay hidden. */
export const ALLOWED_SHARED_SKILL_IDS: readonly string[] = []

export const HIDDEN_TEMPLATE_SLUGS = [ /* the 12 slugs below */ ] as const
export const HIDDEN_TEMPLATE_IDS = [ /* the 12 ids below */ ] as const
```

Helpers:

- `isAllowedTemplateSlug(slug)` — true only for `general`.
- `isHiddenTemplate(id, slug)` — true when id or slug is in the 12.
- `isSharedSkillAllowed(id)` — true only when `ALLOWED_SHARED_SKILL_IDS` contains that id. The empty list means no shared database skill passes.
- `isSkillRowVisible(row, userId)` — true when `row.user_id === userId`. A `user_id` null row is visible only when `isSharedSkillAllowed(row.id)`.
- `isUserAgentVisible(agent)` — false when `source_template_id` is one of the 12 ids, or when `source_template_id` is null and `source_template_name` equals one of the 12 template names. Otherwise true. Rows whose `defaults.builtinKey` is `general` or `task-management` stay visible (those names are not in the 12).

Filter in memory after the existing select. Do not add a SQL `website` predicate. Selects stay on columns this repo's `types.ts` already has. The live `agent_skills` table has `category_id` and `keywords`; starter `schema.sql` does not. Do not require those columns.

`withBuiltinStarter()` in `nextjs/src/lib/agent-templates.ts` injects the code template when the catalog has no matching slug. Point it at slug `general`. The lookup found no `starter-assistant` row.

Built-in Task Management skills are not rows. `listBuiltinSkills()` reads the markdown files in [Built-in Task Management skills](#built-in-task-management-skills). Do not put those files in `ALLOWED_SHARED_SKILL_IDS`.

### Template identifiers

**Code builtin General (keep, rename):**

| Field | Rev 2 value | Was |
|---|---|---|
| Registry key | `general` | none (`STARTER_TEMPLATE_SLUG` was the only id) |
| Slug and catalog id | `general` | `starter-assistant` |
| Display name | `General` | `Starter Assistant` |
| Switcher label for this agent | `General agent` | n/a |
| `skill_ids` | `[]` | `[]` |
| status | `published` | `published` |

Update the description and system prompt so they no longer say "clone it". The catalog `id` stays the slug string, not a uuid. Nothing writes that string into `agent_templates.id` or `chats.agent_id`.

No `INSERT` into `agent_templates` or `agent_skills` exists under `supabase/migrations/` or `supabase/schema.sql`.

**Plain general chat (keep):**

- `AgentSwitcher` keeps `<option value="">General</option>`.
- `GET /api/chats` treats a missing `agent-id` as `agent_id IS NULL`.
- `POST /api/chat` with `agent_id` null uses the default system prompt and does not load `skill_ids`.
- This option is the default. It is not the General agent row.

**Code builtin Task Management (add):**

| Field | Value |
|---|---|
| Registry key | `task-management` |
| Display name | `Task Management` |
| Catalog template row | none |
| Skills | markdown files under `nextjs/src/lib/builtin-skills/task-management/` |

**Database templates (hide all).** Lookup 2026-10-10. None is named General or Task Management. None uses slug `starter-assistant` or `general`.

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

Marketing-agent migrations that insert four of these (reference only, do not copy): `supabase/migrations/20260911010000_seo_agent_agent_id.sql` (`seo-agent`), `20260917190000_klaviyo_agent_skills_template.sql` (`klaviyo-agent`), `20260924120000_video_gen_agent_skills_template.sql` (`video-gen-agent`), `20260926170000_shopify_agent_skills_template.sql` (`shopify-agent`). GitHub code search on marketing-agent `main` found `INSERT INTO public.agent_templates` in those four files only.

### Skill identifiers

Lookup: **114** `agent_skills` rows, all shared (`user_id IS NULL`), **0** personal. Categories on the live table (not in starter `schema.sql`): seo 7, local-seo 11, klaviyo 7, video 16, shopify 14, wix 11, social 12, google-ads 7, meta-ads 7, callrail 6, paid-ads 4, paid-media 7, workflow 4, skill-authoring 1. A search of those names found no task or todo skill (one incidental `wix-cms-collections` hit). There is no template-to-skill join table. Links are `skill_ids uuid[]` on `agent_templates` and `user_agents`.

**Database allow-list: empty.** Do not paste the 114 ids into the repo. Do not allow-list `goal-isolate`, `evidence-before-after`, `review-loop`, `ship-with-approval`, or `create-agent-skill`.

Admin "save as shared" (`writeShared`) inserts `user_id` null. Those new rows stay hidden. Leave shared-write out of the personal flow. Personal upload sets `user_id` and stays visible.

### Where filters apply

| Surface | File | Behavior |
|---|---|---|
| Template list API | `nextjs/src/app/api/agent-templates/route.ts` | After the select, drop hidden slugs/ids. Then `withBuiltinStarter` for `general` only. `?status=all` does not reveal the 12. |
| Template catalog page | remove `nextjs/src/app/(dashboard)/agent-templates/page.tsx` and `AgentTemplateCatalog.tsx` | Users cannot open a clone gallery. |
| Admin template CRUD | `nextjs/src/app/api/admin/agent-templates/**`, `AdminAgentTemplates.tsx` | Remove POST create, PATCH, DELETE, and the admin tab. |
| Clone | `POST /api/agents`, `cloneTemplateToUserAgent` | Reject `starter: true` and any `template_id` (the 12 UUIDs, `starter-assistant`, and `general`). Keep `createBlankUserAgent` for the builtin ensure-row path and for a user's own blank agent. |
| Agent list | `GET /api/agents` | Return only `isUserAgentVisible` rows. |
| Agent by id | `nextjs/src/app/api/agents/[id]/route.ts` | 404 when the row is hidden. PATCH/DELETE of a hidden row 404s and does not update. DELETE of a row with `defaults.builtinKey` returns 400 and does not delete (see selection). |
| Chat switcher | `AgentSwitcher.tsx`, `ChatView.tsx` | Options: General (null), General agent, Task Management, then other visible user agents. Hidden clones are absent. Do not list a builtin row twice. |
| Chat turn | `nextjs/src/app/api/chat/route.ts` | Hidden clone → 403 before `loadAgentSkills`. Null `agent_id` still runs the plain prompt. A visible row with `defaults.builtinKey` runs that builtin. |
| Chat list | `nextjs/src/app/api/chats/route.ts` | Do not delete threads. A request whose `agent-id` is a hidden user-agent id returns an empty list. Null stays the general list. |
| Skill list API | `nextjs/src/app/api/agent-skills/route.ts` | Filter with `isSkillRowVisible`. Add the code builtin skills in a separate field, not as fake uuids. |
| Skill page | `agent-skills/page.tsx`, `actions.ts` | Shared tab: builtin Task Management files only, read-only. Mine: the caller's rows. Keep upload, GitHub import, and create on Mine. |
| Client list | `listAgentSkills()` in `unified.ts` | Same visibility filter before `setSkills`. |
| Pickers | `SkillPicker.tsx`, `AgentEditor.tsx` | Personal skills only, plus a fixed "always on" note for builtin files. `AutomationForm.tsx` goes away with the generic product. |
| Attach on save | `assertSkillIdsVisible`, `load-agent-skills.ts` | Reject a shared database id. Own skills still pass. Builtin file bodies are appended in code and are not `skill_ids`. |
| Skill file preview | `agent-skills/actions.ts` | Refuse to sign a shared object whose id is not allow-listed. Builtin markdown is read from the repo, not the bucket. |

### Existing user agents

Lookup: **4** `user_agents` rows. Three are marketing clones: "Google Ads - ProVet Legal", "Klaviyo Agent - Truman Tool", "Local SEO - Ember Wood". One is "Untitled agent" with no template and 0 skills. The lookup did not print each row's uuid.

**Treatment (locked):** hide the three clones in every list, picker, and chat execution path. Do not `DELETE` them. Do not clear `skill_ids`. `chats.agent_id` is `ON DELETE CASCADE`; a delete would remove threads. The Untitled agent stays. New blank agents remain allowed. New clones of the 12 are not.

---

## What the starter has for tasks

Checked in this repo (no database call):

| Surface | Present? | Where |
|---|---|---|
| Todos page | Yes | `nextjs/src/app/(dashboard)/todos/page.tsx`. Sidebar label "To Do". Dashboard card "Manage your tasks". |
| `/table` redirect | Yes | `nextjs/next.config.ts` redirects `/table` to `/todos`. |
| Table | Yes | `public.todo_list` in `supabase/schema.sql` and `supabase/migrations/20260913223000_slim_starter_baseline.sql`: `id bigint` identity, `title`, `urgent`, `description`, `done`, `done_at`, `owner`. Owner-scoped. |
| Client CRUD | Yes | `nextjs/src/lib/supabase/unified.ts`: `getMyTodoList`, `createTask`, `removeTask`, `updateAsDone` (sets `done` true only). No edit-title and no reopen. |
| Todo MCP server | **No** | No `nextjs/src/app/api/mcp/**`. |
| Task REST API | **No** | No `api/v1/tasks`. |
| Chat task tools | **No** | No `chat-task-tools.ts`. |
| `todo_categories` | **No** in starter SQL | Do not create it. |
| `chats.platform_agent_key` | **No** | Marketing-agent Task Manager uses `PLATFORM_AGENT_TASK_MANAGER = 'task-manager'` and that column. Adding the column is out of scope. |

Phase 3 adds the missing MCP route, REST route, and chat tools **in code**, talking only to `todo_list` through the signed-in user's client (RLS). The skill files describe those four operations: list, create, mark done, delete. They must not describe categories, assignees, or a platform-agent column.

---

## How Task Management is selected

### Column types (starter schema and baseline migration)

`public.chats` (`supabase/schema.sql` and `20260913223000_slim_starter_baseline.sql`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `user_id` | uuid | owner |
| `title` | text | |
| `model_id` | text | default `poolside/laguna-s-2.1:free` |
| `agent_id` | uuid | `REFERENCES public.user_agents(id) ON DELETE CASCADE`. Comment: NULL = general chat. |
| `created_at`, `updated_at` | timestamptz | |

There is no jsonb metadata column on `chats`. `public.messages.content` is jsonb for the message body, not chat settings. `public.automations.agent_id` is the same kind of uuid foreign key (`ON DELETE SET NULL`).

`public.user_agents.defaults` is `jsonb NOT NULL DEFAULT '{}'`. `AgentDefaultsV1` in `nextjs/src/lib/agent-templates.ts` is `{ model_id?: string; [key: string]: unknown }`. `parseDefaults` copies unknown keys through. A `builtinKey` string survives that parser. No new column.

### Why a sentinel in `chats.agent_id` does not work

- A non-uuid such as `task-management` or `platform:task-manager` cannot be stored. The column type is uuid.
- A reserved uuid that is not a `user_agents.id` fails the foreign key.
- Dropping or relaxing that foreign key, or adding `platform_agent_key`, is a schema change. Out of scope.

Null `agent_id` cannot mean both "plain General" and "Task Management". Reopening a saved thread would not know which one it was.

### Chosen mechanism

Code registry in `nextjs/src/lib/builtin-agents.ts` with keys `general` and `task-management`.

**Plain default.** Switcher value `""` leaves `chats.agent_id` null. No `user_agents` insert. No catalog skills. This is the general default Truman asked to keep.

**Durable builtin.** The first time the user picks "General agent" or "Task Management" (switcher, or `/chat?builtin=general|task-management`), the server ensures one visible `user_agents` row for that user and that key:

- Insert goes through the existing `createBlankUserAgent` path. Not a clone. `source_template_id` null. `source_template_name` `''` (must not equal one of the 12 names).
- `name` is `General` or `Task Management`.
- `defaults` is `{ builtinKey: 'general' | 'task-management', model_id }` using the existing jsonb column and `DEFAULT_AGENT_MODEL` unless the user has set a model.
- Find-before-insert: load the caller's agents and match `defaults.builtinKey` in memory. One row per user per key.
- New and continued threads store that row's real uuid in `chats.agent_id`.

On each turn the server reads `defaults.builtinKey` from the row it loaded. It does not trust a client `builtinKey` on a thread that already has an agent id. Null `agent_id` ignores `builtinKey` and stays plain general chat. The query param only chooses which row to ensure before the first bind.

For `task-management`, the server appends the bundled skill markdown and registers the task tools. For `general`, it uses the General system prompt and does not register task tools. Personal `skill_ids` on that row load through the existing `loadAgentSkills` path.

**Do not delete builtin rows.** `DELETE /api/agents/[id]` for a row with `defaults.builtinKey` returns 400. `ON DELETE CASCADE` would destroy that user's threads.

This needs no new column and no `platform_agent_key`. The insert is the same write the blank-agent API already does, triggered when the user selects the agent.

### How skill assignment works without a schema change

Built-in Task Management skills have no `agent_skills` uuid. `skill_ids` is `uuid[]` with cardinality ≤ 8. Those files cannot be stored in the array. They are always on for the Task Management row and always off for everyone else.

User-uploaded skills have real uuids and `user_id` = the caller. Assigning one to both agents means writing that uuid into `skill_ids` on **each** ensured `user_agents` row (General agent and Task Management), via the existing agent PATCH. The same uuid may appear on both rows. The server still rejects any shared database id.

**Limitations:**

- Plain null chat does not read either row's `skill_ids`. Assigning skills to "General" affects the General agent row only. Say that on the skills screen.
- At most 8 personal skills per row (existing check). Builtin files do not count toward the 8.
- The rows exist only after the user selects that agent. Until then there is nowhere durable to store the assignment.
- A browser `localStorage` map was considered and is **not** the store. It would be per browser, invisible to the server unless the client posted ids, and easy to desync. The `user_agents` row is already per user and is what chat reloads.
- Deleting the row is refused so threads are not cascaded away. A user who wants a skill off removes it from `skill_ids`; they do not delete the agent.

---

## Built-in Task Management skills

Add these files (instruction text, not database rows):

| File | Teaches |
|---|---|
| `nextjs/src/lib/builtin-skills/task-management/list-tasks.md` | List the signed-in owner's `todo_list` rows. |
| `nextjs/src/lib/builtin-skills/task-management/create-task.md` | Create with `title`, optional `description`, optional `urgent`. |
| `nextjs/src/lib/builtin-skills/task-management/complete-task.md` | Mark done (`done`, `done_at`). No reopen. |
| `nextjs/src/lib/builtin-skills/task-management/delete-task.md` | Delete one owned row by id. |

Also add, in code (not as a fifth skill file unless the text fits cleaner there):

- `POST /api/mcp/tasks` — MCP-style tool call for those four operations.
- `GET` and `POST /api/v1/tasks`, plus complete and delete on `/api/v1/tasks/[id]`.

Both use the user session. Do not use the service role. Do not add columns. Chat calls the same functions from `nextjs/src/lib/chat-task-tools.ts` only when the bound row's `builtinKey` is `task-management`.

The skills page lists these four files on the shared/built-in tab. They are not editable and not deletable.

---

## Current-state inventory

App root is `nextjs/`. Schema contract in git is `supabase/schema.sql` plus `supabase/migrations/`. The live shared database has columns and policies this repo does not define. Do not "fix" that with a migration.

### Pages

| Path | Keep? |
|---|---|
| `/` | Keep. Drop copy that advertises generic Automations or a template catalog. |
| `/dashboard` | Keep. Remove Templates and Automations cards. Add a Task Management card to `/chat?builtin=task-management`. Keep the To Do card (`/todos`). Keep any blog/posts entry that already exists; do not add a card that 404s. |
| `/documents/**`, `/storage` | Keep. |
| `/todos` | Keep. Human task UI. The agent uses the API, not this page, but the page stays. |
| `/chat`, `/chat/[id]` | Keep. Three modes: null General, General agent, Task Management. |
| `/agents`, `/agents/[id]` | Keep for visible agents, including the two builtin rows once they exist. Remove "Browse templates" / "Use a template". |
| `/agent-skills` | Keep, filtered. |
| `/agent-templates` | **Remove.** |
| `/automations`, `/automations/new`, `/automations/[id]` | **Remove** with the generic product. Phase B may add an admin-only blog automation screen later. Do not leave the generic pages up until then. |
| `/my-posts/**` | Keep. |
| `/admin` | Keep settings. Remove the templates tab. |
| `/admin/blog` | Keep. Phase A turns it into the My Posts dashboard. |
| `/posts/**`, `/posts/rss.xml` | Keep. Public label is Blog. Route stays `/posts`. |
| Contact, legal, auth | Keep. |

`protectedPaths` in `nextjs/src/lib/supabase/middleware.ts` includes `/agent-templates` and `/automations`. Remove those when the routes are gone. Leave `/todos`, `/chat`, `/agents`, `/agent-skills`, `/my-posts`, `/admin`.

### Dashboard sidebar (`AppLayout.tsx`)

Everyone today: Home, Documents, My Files, To Do, Chat, Agents, Skills, Templates, Automations, Posts `/my-posts`, User Settings.

Admins: Admin Settings `/admin`, Blog `/admin/blog`, Agent Templates `/admin?tab=templates`.

Rev 2:

- Remove Templates, Automations, and Admin → Agent Templates in the cleanup phases.
- Add nothing that points at a deleted route.
- Phase A replaces the admin Blog link with the #150 submenu (My Posts). Non-admins get a Blog item that opens `/posts` in a new tab. Keep Posts → `/my-posts` so authors still have the editor.
- Phase B adds Admin → Blog → Post Automations (`/automations?type=blog`) and not before.

### Public header

`MenuNav.tsx` and `MobileMenu.tsx`: Features, How it works, Pricing, TOS dropdown, **Blog** (`href="/posts"`), Contact. There is no Services menu. Blog is already top-level. Do not move it under TOS.

Truman's rule (marketing-agent `nextjs/src/lib/services/nav.ts`, `BLOG_NAV_ITEM`, place immediately after Services): this repo has no Services item, so do not invent one. Blog stays a top-level link. If a Services item is ever added, Blog is the next top-level sibling after it, never a child. Do not rename `/posts` to `/blog`.

### API routes

| Route | Action |
|---|---|
| `api/agent-templates` | Filter to the `general` builtin, or remove the route if nothing calls it. |
| `api/admin/agent-templates/**` | Remove. |
| `api/agents`, `api/agents/[id]` | Keep. Strip clone. Hide marketing clones. Ensure-row and builtin delete guard live here. |
| `api/agent-skills` | Keep. Filter. Return builtin file descriptors separately. |
| `api/chat`, `api/chats` | Keep. Branch on null vs `defaults.builtinKey`. |
| `api/mcp/tasks`, `api/v1/tasks` | **Add** in Phase 3. `todo_list` only. |
| `api/automations/**`, `api/cron/automations`, `api/workers/automations` | **Remove** (generic product). |
| `api/cron/auto-blog` | **Phase B only**, and only after the Pro decision. |
| `api/posts/**`, `api/tags` | Keep. |
| Admin settings, user, stripe, privacy, terms, auth, documents | Keep. |

### `vercel.json` crons

`nextjs/vercel.json` today:

```json
{ "path": "/api/cron/automations", "schedule": "17 9 * * *" }
{ "path": "/api/workers/automations", "schedule": "47 9 * * *" }
```

Both are daily, which Vercel Hobby allows. Both drive the generic OpenRouter queue (`CRON_SECRET` via `nextjs/src/lib/cron-auth.ts`). Neither writes a blog post.

Marketing-agent `docs/plans/auto-blogging.md` does **not** use those schedules for blog posts. A blog automation is an `automations` row with `next_run_at` null, so `enqueue_automation_run` never picks it up. The blog scheduler is a new `GET /api/cron/auto-blog` at `0 * * * *` (hourly). That schedule is a Vercel Pro cron. Hobby is daily-only. The starter is on the same Hobby team as marketing-agent, so it has the same Pro dependency. Chief of Staff applies the `auto_blog_*` migrations immediately before #148 merges, and only if the team moves to Pro.

**Cleanup:** delete the two daily entries and their routes. **Do not** add the hourly entry in that change. Keep `CRON_SECRET` in `nextjs/.env.template` and `.env.example`. The comment should say the generic daily crons are gone and the secret is for Phase B's auto-blog cron. Keep `nextjs/src/lib/cron-auth.ts`.

### Env vars

| Name | Action |
|---|---|
| Supabase URL, anon key, service key | Keep. |
| `OPENROUTER_API_KEY` | Keep. Chat, documents, and later Phase B use `resolveOpenRouterKey` (BYOK, then `admin_settings.openrouter_api_key`, then this env). |
| `CRON_SECRET` | Keep. Do not remove it with the generic crons. |
| `POSTS_WEBSITE` | Keep. Allowed values: `edu`, `marketing-agent`, `afterallcare`. No default. |
| `AUTO_BLOG_MODEL`, `AUTO_BLOG_MODEL_FALLBACK`, `AUTO_BLOG_EMBEDDING_MODEL` | Phase B only. Optional. Document in the env template when that phase starts. Empty means "use `DEFAULT_AGENT_MODEL`". Do not hardcode marketing-agent model ids. |
| `FIRECRAWL_API_KEY`, `YOUTUBE_DATA_API_KEY` | Phase B only, as env fallbacks. Empty by default. Do not insert `admin_settings` rows. |
| Stripe, site origin, `ADMIN_SETTINGS_APP_KEY`, product name, SSO | Keep. |
| Composio / Treg / `OPENROUTER_API_KEY_REACHTHEMAI` | Already "do not set". Leave the warning. |

`@paddle/paddle-js` and `@paddle/paddle-node-sdk` have no import under `nextjs/src`. Remove them in the dead-code pass.

---

## Blogging

Starter public blog is `/posts`. Marketing-agent public blog is `/blog`. Compare behavior, not the path. Adapt every `website = 'marketing-agent'` hardcode to `requirePostWebsite(process.env.POSTS_WEBSITE)`. Adapt origins to the starter's site origin env. Do not copy `BLOG_WEBSITE` from `nextjs/src/lib/blog/constants.ts` on marketing-agent.

### Already in the starter (keep)

- Authoring `/my-posts`, `PostEditor.tsx`, `api/posts`.
- `posts.body_doc` (migration `20261009140100_posts_body_doc.sql`) and the missing-column fallback in `posts-store.ts`.
- Public roll `/posts` (#24 puts the heading and list before the sidebar on small screens).
- Taxonomy routes, `blog_categories`, `blog_tags`, `blog_author_profiles`, `blog_revisions`, `blog_media`, `blog_comments`, `newsletter_subscribers`.
- Author columns **in starter SQL:** `user_id`, `slug`, `display_name`, `bio`, `avatar_url`. `blog-taxonomy.ts` already tries `linkedin_url`, `title`, `company`, `location`, then a narrower select.
- `cover_image_alt` is optional in `posts-store.ts`. It is not in starter `CREATE TABLE`.
- RSS, sitemap, Open Graph image route, newsletter, comments, `blog-seo.ts` JSON-LD from title, summary, and cover URL.
- Admin `/admin/blog` with a **hard** `delete()` in `deleteBlogPost`. Phase A replaces that hard delete. Do not hard-delete in Phase A.
- TipTap table extensions stay if `PostEditor` mounts them.

### Phase A — blog dashboard (#150 phases 1–6)

**Can start now.** Marketing-agent ships this first. The only migration it needs, `posts.deleted_at`, is already on `glplvrljdgowcwuubkau`. The starter applies nothing. On a database that lacks the column, use the existing missing-column fallback (`logBlogSchemaGap`, codes `42P01`, `42703`, `PGRST200`, `PGRST204`, `PGRST205`): show an error. Do not fall back to hard `DELETE`.

Spec: marketing-agent `docs/plans/blog-dashboard-menu.md`. Also fold in the code-only parts of live PRs #115–#136 that the starter does not have yet. Do not add the Post Automations item in this phase.

- [ ] Non-admins: sidebar Blog opens `/posts` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). Keep `/my-posts`.
- [ ] Admins: Blog submenu. "My Posts" is the existing `/admin/blog` list. Do not point that label at `/my-posts`.
- [ ] List shows cover, a short text preview, Edit, and Delete. Delete uses `AlertDialog` (`nextjs/src/components/ui/alert-dialog.tsx`) and includes the title.
- [ ] Delete sets `deleted_at`. It does not call `.delete()`. Soft-deleted posts disappear from the public roll and from the admin list.
- [ ] Editor: Visual and HTML edit the same `body_doc` / `body`. Back returns to `/admin/blog` or `/my-posts`, whichever opened the editor. No horizontal overflow at 375px.
- [ ] YouTube embeds: port the nocookie TipTap node (`youtube.ts` / `youtube-extension.tsx` on marketing-agent) onto `/posts`. Do not insert a YouTube API key row.
- [ ] SEO fields: read and write `seo_title`, `meta_description`, `og_image_url` with the same missing-column fallback. They are on the shared table and absent from starter `schema.sql`. Do not require them. `blog-seo.ts` uses them when present and otherwise keeps title, summary, and cover URL.
- [ ] Admins can edit any post (marketing-agent #130). Do not add `posts_block_author_id_change`; it is already on the shared database and is not in starter migrations. Do not change `author_id` on update.
- [ ] Public header Blog stays top-level, immediately after Services when Services exists. It does not exist here, so leave Blog where it is.
- [ ] `supabase/` has no new file when Phase A is done.

`auto_blog_posts.post_id` is `ON DELETE RESTRICT` in `docs/plans/auto-blogging.md` (the table is not on the shared database until Phase B's migrations). Soft delete does not `DELETE` the `posts` row, so that restrict does not fire. A hard delete of a post that later has an `auto_blog_posts` row would fail. Phase A therefore never hard-deletes. Chief of Staff also reported that authenticated hard delete of blog posts is already unavailable on the shared database (restrictive policy).

### Phase B — auto-blog (#141–#148)

**Do not start** until both are true:

1. Chief of Staff confirms the `auto_blog_*` migrations are live on `glplvrljdgowcwuubkau`. Those migrations are applied right before marketing-agent #148 merges, and only if the team moves to Vercel Pro for the hourly cron.
2. Truman decides that this Hobby team moves to Vercel Pro so `0 * * * *` can run. See [Open questions](#open-questions).

The starter applies none of those migrations. A fresh clone on its own database does not have them until someone applies the marketing-agent SQL elsewhere. This repo still does not.

Source of truth: `docs/plans/auto-blogging.md` and the quality gate in `docs/plans/ai-content-checker.md`. Port the pipeline, not the public `/content-check` product (that product's tables, monitors, and `/api/cron/content-checks` are out of scope unless Chief of Staff's post-merge file list says otherwise). The in-process rule check that auto-blog runs before publish is part of this phase, in Next.js, without a new table from this repo.

What to port once unblocked:

- Admin-only blog automation: an `automations` row plus `auto_blog_configs`. `next_run_at` null. Non-admins get 403.
- Hourly `GET /api/cron/auto-blog` (`authorizeCronRequest`, then one slot, then the worker). Add the `vercel.json` entry only on Pro.
- Slots, topic dedup, pipeline, images, YouTube, usage, resume, and the per-run dollar cap, as that plan specifies.
- Sidebar: Admin → Blog → **Post Automations** → `/automations?type=blog`. This item is Phase B, not Phase A.
- Rewrite `executeQueuedRun` (`nextjs/src/lib/automation-worker.ts`) so a row that has an `auto_blog_configs` record runs the pipeline. Generic prompt automations are not offered in the UI.

Marketing-agent-specific bits to adapt (do not copy verbatim):

| Marketing-agent | Starter |
|---|---|
| `website = 'marketing-agent'` / `BLOG_WEBSITE` | `requirePostWebsite(process.env.POSTS_WEBSITE)`. No default. |
| Public path `/blog` | `/posts` |
| Anon read policy scoped to `website = 'marketing-agent'` | Already true on the shared database. App filters still use `POSTS_WEBSITE`. If that env is `edu` or `afterallcare`, anonymous `/posts` can be empty. **Do not change the policy.** |
| Admin SQL `edu.is_admin()` | Live shared policies use it. Starter app code uses `user_data.user_role = 'admin'` (`isAdminUser` / admin actions). Starter SQL defines `authenticative.is_admin()` and has no `edu` schema. Phase B gates routes with the existing Next.js admin check. Do not create or replace either function. Do not add RLS. |
| Secret rows `marketing_agent_youtube_data_api_key`, `marketing_agent_firecrawl_api_key` | Code may **read** those names if Chief of Staff or Truman has provisioned them. Also read `starter_youtube_data_api_key` and `starter_firecrawl_api_key`. Then env `YOUTUBE_DATA_API_KEY` and `FIRECRAWL_API_KEY`. Never read Edu's `youtube_data_api_key`. **Do not insert rows.** Mask secrets with the existing concealed-field helper when a row is present. |
| `auto_blog_posts.post_id ON DELETE RESTRICT` | Deletes stay soft (`deleted_at`). Do not `DELETE FROM posts`. |
| Draft model `openai/gpt-6-astra-pro`, fallback `anthropic/claude-opus-5.5`, check model `deepseek/deepseek-v4.1-flash` | Do not hardcode these. Resolve primary and fallback with `parseModelId`: admin_settings `auto_blog_draft_model` and `auto_blog_draft_model_fallback` if those rows already exist, else `AUTO_BLOG_MODEL` / `AUTO_BLOG_MODEL_FALLBACK`, else `DEFAULT_AGENT_MODEL` (`poolside/laguna-s-2.1:free` in `agent-templates.ts`). Always send the resolved ids on insert so a marketing column default cannot leak in. API key stays `resolveOpenRouterKey`. Embedding model follows the same pattern (`AUTO_BLOG_EMBEDDING_MODEL`); if unset, use the Jaccard fallback from auto-blogging.md and do not enable `vector`. |
| Skill ids `seo-humanizer`, `seo-agent`, `seo-firecrawl`, and a new `seo-blog-post` row | Those ids are part of the hidden 114, or a row this plan must not insert. Bundle the pipeline instructions as code files under `nextjs/src/lib/builtin-skills/auto-blog/`. Do not attach the hidden uuids. |
| `integrations` column on `automations` | Not in starter `automations`. Do not add it. The starter worker has no Composio path. |

Keep these modules through the generic-product removal so Phase B has them: `nextjs/src/lib/automations.ts`, `automation-schedule.ts`, `automation-worker.ts`, `cron-auth.ts`. Remove their generic routes and UI in Phase 5. `llm_turn_rates.automation_run_id` stays in SQL (do not migrate). Auto-blog usage goes to `auto_blog_usage` (Chief of Staff's table), not a second call to `record_llm_turn_usage` per pass.

### Fresh clone

A database built only from this repo's migrations does not have:

- `posts.seo_title`, `meta_description`, `og_image_url`, `deleted_at`, `cover_image_alt`
- `blog_author_profiles.linkedin_url`, `title`, `company`, `location`
- `posts_block_author_id_change`
- `edu.is_admin()` or the live anon policy that filters `website = 'marketing-agent'`
- `auto_blog_configs`, `auto_blog_topics` (pgvector), `auto_blog_usage`, `auto_blog_posts`, slots, pipeline steps, alerts
- the firecrawl and YouTube `admin_settings` rows, or an `seo_blog_post` skill row

Phase A and Phase B must keep working on the shared project via columns Chief of Staff already applied (Phase A) or will apply (Phase B). They must not crash a fresh clone: missing-column and missing-table errors log and surface a clear message. This repo does not add the migrations to "fix" the clone.

### Shared DB vs this repo (do not re-query, do not edit)

Already on `glplvrljdgowcwuubkau` (Chief of Staff): `posts.body_doc`, `cover_image_alt`, `seo_title`, `meta_description`, `og_image_url`, `deleted_at`; restrictive soft-delete SELECT policies; no authenticated hard delete of blog posts; `posts_block_author_id_change`; anon blog read scoped to `website = 'marketing-agent'`; `blog_author_profiles` including linkedin/title/company/location; revisions; `blog-media`; comments; `newsletter_subscribers`; `edu.is_admin()` for `authenticated` and `service_role` only.

Not applied until the Pro / #148 gate: `auto_blog_*`, firecrawl key row, `seo_blog_post_skill` row.

Starter `posts_select_published_blog` in `schema.sql` does **not** filter `website`. The comment says a fresh starter database is not the shared project. Do not edit that policy on the live project. For anonymous `/posts` on the shared database to return rows, `POSTS_WEBSITE` has to be `marketing-agent`.

---

## Automations (generic product)

`nextjs/src/lib/automations.ts` is a generic scheduler: name, prompt, frequency (`once`, `daily`, `weekdays`, `weekly`, `monthly`, `yearly`), timezone, model, `skill_ids`, optional `agent_id`. No `type=blog` and no post insert. UI: `AutomationForm`, `AutomationList`, `AutomationDetail`. Cap `MAX_AUTOMATIONS_PER_USER` 20.

**Remove** the pages, `components/automations/**`, `api/automations/**`, `api/cron/automations`, `api/workers/automations`, the two `vercel.json` entries, the sidebar item, and the dashboard card.

**Keep** the SQL tables (no DDL) and the four lib files named in Phase B. Keep `load-agent-skills.ts` (chat uses it). Keep `llm-usage.ts`. Chat recording must still work when `automation_run_id` is null.

Creating a post by hand stays `POST /api/posts` and `/my-posts/new`.

---

## Other marketing-agent-only code

| Item | Verdict | Why |
|---|---|---|
| 12 DB templates | **Hide** | Marketing catalog. No app column. |
| 114 shared skills | **Hide** | Task skills are code files. |
| Three cloned `user_agents` | **Hide** | Rows stay. |
| Untitled `user_agents` row | **Keep** | No template. |
| Builtin General + Task Management | **Keep** | Code registry plus optional `user_agents` rows. |
| Plain chat (`agent_id` null) | **Keep** | The general default. |
| `/todos` + `todo_list` | **Keep** | Human UI and the agent's data. |
| Personal skill upload / GitHub import | **Keep** | Assignable to both builtin rows. |
| Template gallery, admin template editor, clone | **Remove** | Users must not create or clone templates. |
| Generic automations UI + the two daily crons | **Remove** | Not blog posting. |
| `cron-auth.ts`, `CRON_SECRET`, worker libs | **Keep** | Phase B. |
| Composio, Google Ads runtime, brand profiles | **Already absent** from `nextjs/src`. Do not add them. |
| `required_toolkits` / `mcp_config` columns | **Keep the columns.** Leave unused. The new task MCP is an HTTP route, not a toolkit runner. |
| `POST_WEBSITES` including `marketing-agent` | **Keep** | Shared `posts.website` check. |
| Social profile URLs, Stripe, documents, files, auth, admin settings, BYOK | **Keep** | |
| Paddle packages | **Remove from package.json** | No source import. |
| Public `/content-check` product | **Do not port** | Not the blog dashboard or the auto-blog pipeline. |
| `chats.platform_agent_key` | **Do not add** | Selection uses `user_agents.defaults`. |

---

## Phased tasks

### Phase 1 — Allow-list module

Files: `nextjs/src/lib/starter-catalog-allowlist.ts`, `nextjs/src/lib/builtin-agents.ts`, and a node test next to the other `src/lib/*.test.ts` files (add it to the `test` script in `nextjs/package.json`).

- [ ] The 12 slugs are hidden. `general` is allowed. `starter-assistant` is not a special case.
- [ ] A shared skill id is hidden. A row with `user_id` equal to the caller is visible.
- [ ] A `user_agents` row whose `source_template_id` is `8b57e722-6e18-4862-aa5b-acf5cd39acd3` is hidden.
- [ ] A row with null `source_template_id`, empty `source_template_name`, and `defaults.builtinKey === 'task-management'` is visible.
- [ ] `builtinKeyFromDefaults` returns null for `{}` and for `{ model_id: 'poolside/laguna-s-2.1:free' }`.

**Done when** the tests pass and no other behavior has changed.

### Phase 2 — General rename, hide templates, remove create/clone

Files: template and agent routes listed in the filter table, `agent-templates.ts` (`STARTER_TEMPLATE`, slug `general`, name `General`), `clone-user-agent.ts`, `AgentTemplateCatalog.tsx`, `AdminAgentTemplates.tsx`, `AgentsPage.tsx`, `agent-templates/page.tsx`, `AdminSettingsTabs.tsx`, `AppLayout.tsx`, `middleware.ts`, dashboard and homepage copy.

- [ ] `GET /api/agent-templates` returns at most the General builtin.
- [ ] `POST /api/agents` with any of the 12 ids, `starter: true`, or template id `general` returns 400 or 404 and inserts nothing.
- [ ] `POST /api/agents` with a name and no template still creates a blank agent.
- [ ] `GET /api/agents` omits the three marketing clones and includes Untitled.
- [ ] `/agent-templates` is gone. Sidebar has no Templates link. Admin has no Agent Templates item.
- [ ] Plain General chat (`agent_id` null) still completes a turn.

**Done when** a signed-in user cannot create or clone a template, the 12 recipes are not listed, and null-agent chat still completes a turn.

### Phase 3 — Task Management agent, skills, and selection

Files: `builtin-agents.ts`, `builtin-skills/task-management/*.md`, `chat-task-tools.ts`, `app/api/mcp/tasks/route.ts`, `app/api/v1/tasks/route.ts`, `app/api/v1/tasks/[id]/route.ts`, `app/api/chat/route.ts`, `app/api/agents/route.ts`, `AgentSwitcher.tsx`, `ChatView.tsx`.

- [ ] Switcher shows General (null), General agent, and Task Management.
- [ ] Choosing Task Management ensures one `user_agents` row with `defaults.builtinKey = 'task-management'` and binds `chats.agent_id` to that uuid.
- [ ] Choosing General (empty value) does not insert a row and saves `agent_id` null.
- [ ] Choosing General agent ensures `builtinKey = 'general'`.
- [ ] A Task Management turn can list, create, complete, and delete the caller's own `todo_list` rows through the new routes. It cannot see another owner's rows.
- [ ] A plain General turn does not register task tools.
- [ ] DELETE of either builtin row returns 400.
- [ ] No new file under `supabase/`.

**Done when** both builtins and null chat work, and a Task Management thread still shows the right agent after reload.

### Phase 4 — Skills

Files: `api/agent-skills/route.ts`, `agent-skills/page.tsx`, `actions.ts`, `unified.ts` `listAgentSkills`, `assertSkillIdsVisible`, `load-agent-skills.ts`, `AgentEditor.tsx`, `SkillPicker.tsx`.

- [ ] Shared database skills are absent. The four Task Management files are listed and cannot be deleted.
- [ ] Upload and GitHub import on Mine still create a row with the caller's `user_id`.
- [ ] That skill can be saved onto both the General agent row and the Task Management row.
- [ ] Saving a shared id from the 114 returns an error and does not persist it.
- [ ] Plain null chat does not load those personal skills. The copy on the agent editor says so.
- [ ] Preview of a non-allow-listed shared skill is rejected.

**Done when** the skills page offers personal upload and the builtin files, and does not list the marketing catalog.

### Phase 5 — Remove the generic automations product

- [ ] No page or API answers `/automations` or `/api/automations`.
- [ ] `vercel.json` has no cron entries.
- [ ] `cron-auth.ts`, `automations.ts`, `automation-schedule.ts`, and `automation-worker.ts` still exist.
- [ ] `CRON_SECRET` remains in the env templates, with a comment that it is unused until Phase B.
- [ ] Sidebar and dashboard have no generic Automations link.
- [ ] `/my-posts/new` still creates a draft.
- [ ] Chat and documents still call OpenRouter.

**Done when** the generic scheduler UI is gone and the worker modules still typecheck.

### Phase 6 — Dashboard and nav for the cleanup

- [ ] Dashboard cards: no Templates, no Automations, no href that 404s. Task Management card opens `/chat?builtin=task-management`. To Do, Documents, Files, Chat, Agents, Skills, User Settings remain. Blog/posts links that already work stay.
- [ ] Homepage no longer promises Automations or a template catalog.
- [ ] Grep `nextjs/src` for `/agent-templates`, `cloneTemplateToUserAgent`, `AdminAgentTemplates`. Each hit is deleted or a comment that the feature is gone. `/automations` may remain only as a Phase B comment, not a link.
- [ ] Remove the two Paddle dependencies from `nextjs/package.json` and the lockfile.
- [ ] Header Blog is still top-level to `/posts`.

**Done when** `rg` over `nextjs/src` finds no user-facing link to a removed page.

### Phase A — Blog dashboard

Not blocked by Chief of Staff. Do not combine it with Phase B. `supabase/` stays untouched.

Files: `AppLayout.tsx`, `admin/blog/page.tsx`, `admin/blog/actions.ts`, `PostEditor.tsx`, `my-posts` editor, public post page, `blog-seo.ts`, `posts-store.ts`. Port YouTube embed code into `nextjs/src/lib/blog/` (new files are fine).

- [ ] The Phase A checklist in [Phase A](#phase-a--blog-dashboard-150-phases-16) is done.
- [ ] Admin delete on the shared project sets `deleted_at` and the post leaves the public list.
- [ ] A missing `deleted_at` column logs a schema gap and does not hard-delete.
- [ ] Public header Blog is still not inside a dropdown.

**Done when** an admin and a non-admin see the #150 navigation, and `git status` shows no `supabase/` change.

### Phase B — Auto-blog

Blocked on the two gates at the top of [Phase B](#phase-b--auto-blog-141148).

- [ ] Confirm Chief of Staff's "migrations are live" note before writing the cron.
- [ ] Confirm Truman's Pro decision before adding `0 * * * *`. If the decision is no, stop. Do not substitute a daily cron.
- [ ] Port from `docs/plans/auto-blogging.md` using the adaptation table. Website is `POSTS_WEBSITE`. Models come from the starter OpenRouter resolver. Skills are code files.
- [ ] Post Automations appears under the admin Blog submenu and goes to `/automations?type=blog`.
- [ ] Non-admins cannot create a blog automation.
- [ ] Generic prompt automations stay unavailable.
- [ ] No new file under `supabase/`.

**Done when** an admin can save a blog automation against the already-live tables, the hourly route is only present if Pro was approved, and a non-admin cannot.

---

## Risks

| Risk | What to do |
|---|---|
| Null chat and the General agent are easy to confuse. | Labels: "General" (no agent) and "General agent". Null does not load `skill_ids`. |
| Client sends `builtinKey` with someone else's agent id. | Server uses only the loaded row's `defaults.builtinKey` and `user_id`. Null agent id ignores `builtinKey`. |
| Ensuring a row looks like a forbidden seed. | It runs when that user selects the agent, through `createBlankUserAgent`. No migration and no SQL script. |
| Deleting a builtin row cascades chats. | DELETE returns 400. |
| `assertSkillIdsVisible` today allows any shared skill the caller can read. | The new check rejects every shared database id. RLS stays as it is. |
| Hidden clones still have `skill_ids`. | Chat 403s before `loadAgentSkills`. Do not delete the rows. |
| `withBuiltinStarter` id `general` is not a uuid. | Clone and template POST reject it. Ensure-row never writes it into `agent_id`. |
| Hobby cron vs hourly auto-blog. | Phase 5 leaves `vercel.json` with zero crons. Phase B adds hourly only after Pro. |
| Phase A hard delete. | Soft delete only. Restrict from `auto_blog_posts` and the live "no authenticated hard delete" policy both reject `.delete()`. |
| Anon public blog empty when `POSTS_WEBSITE` is not `marketing-agent`. | Document it. Do not edit the policy. |
| `edu.is_admin()` vs `authenticative.is_admin()`. | App gate stays `user_role = 'admin'`. Do not replace functions. |
| Marketing column defaults (`gpt-6-astra-pro`) on tables this repo does not own. | Phase B inserts always set model id columns from the starter resolver. |
| Reading `marketing_agent_*` secret rows. | Read-only, service role, masked. If the row is absent, use env, then continue without that provider. Do not insert. |
| Attaching hidden SEO skill uuids in the pipeline. | Use code files. The 114 stay hidden. |
| Fresh clone missing `deleted_at` or `auto_blog_*`. | Missing-column / missing-table fallback. No migration in this repo. |
| Removing generic routes while chat imports a shared helper. | Delete routes only. Keep `load-agent-skills.ts` and the four automation libs. |

---

## Verification

From `nextjs/`:

- [ ] `npm test` (include the allow-list test).
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`

There is no `typecheck` script. `tsc` is the typecheck.

Manual, against the **already running** shared project. Do not restore the paused project. Do not run SQL.

**Non-admin**

- [ ] Sidebar: no Templates, no generic Automations. To Do, Chat, Agents, Skills, Posts still open.
- [ ] `/agent-templates` and `/automations` 404 (until Phase B adds the blog-only screen).
- [ ] Chat "General" (empty option) sends a message and the saved thread has no agent.
- [ ] "General agent" and "Task Management" each bind a thread. Reload keeps the choice. Task Management can create a todo the user then sees on `/todos`.
- [ ] Agents list does not show the three marketing clones. Untitled still opens.
- [ ] Skills: marketing catalog hidden; four builtin files visible; upload a small `.md` on Mine; attach it to both builtin agents; plain General chat does not use it.
- [ ] Header Blog goes to `/posts` and is not inside a dropdown.
- [ ] `/my-posts/new` saves a draft.

**Admin**

- [ ] Admin submenu has no Agent Templates.
- [ ] Phase A: Blog submenu, My Posts, cover, preview, Edit, AlertDialog soft delete. Do not hard-delete a real post. Prefer a draft created for the test.
- [ ] Phase A: no Post Automations item.
- [ ] Admin settings save still works (a non-secret field).
- [ ] Dashboard has no card whose href 404s. Task Management card opens chat.
- [ ] Phase B (only after both gates): Post Automations is visible, a blog automation saves, `vercel.json` contains the hourly path only if Pro was approved.

---

## Out of scope

- Any migration, `schema.sql` edit, RLS/policy change, seed, row delete, or restore of `cyczlgdaocwueaacqxsh`.
- A `website` / `app_key` column on `agent_templates`, `agent_skills`, or `user_agents`.
- `chats.platform_agent_key` and storing a non-uuid sentinel in `chats.agent_id`.
- `todo_categories`.
- Deleting or archiving the 12 templates, the 114 skills, the 3 clones, or their storage objects.
- Inserting `agent_skills` rows for Task Management or for `seo-blog-post`.
- Inserting `admin_settings` rows (`starter_*` or `marketing_agent_*` keys, model ids, firecrawl, YouTube).
- Changing the anon blog SELECT policy, `edu.is_admin()`, or `authenticative.is_admin()`.
- Applying `auto_blog_*`, pgvector, or `posts` column migrations from this repo. Phase B waits until Chief of Staff has applied them.
- Adding the hourly cron before Truman approves Vercel Pro.
- The public AI content checker (`/content-check`, monitors, `content_checks` tables, `/api/cron/content-checks`), unless the post-merge file list from Chief of Staff includes it.
- Renaming `/posts` to `/blog`.
- Inventing a Services menu. Blog is already top-level.
- Composio, Google Ads, Meta Ads, Klaviyo, Shopify, Wix, CallRail, Semrush, or brand profiles.
- Writing to `trumantool/marketing-agent`.

---

## Open questions

Rev 1 questions 1–3 are answered in the changelog and the locked decisions. These remain:

1. **Vercel Pro vs Hobby for auto-blog.** Phase B needs `0 * * * *`. Hobby runs daily crons only, and the starter is on the same Hobby team as marketing-agent. Chief of Staff applies `auto_blog_*` only if the team moves to Pro. Say whether Phase B should add the hourly cron (Pro) or stay blocked. Do not ship a daily substitute unless you explicitly want that.
2. **`POSTS_WEBSITE` for this deploy.** Anonymous `/posts` on the shared database only returns `website = 'marketing-agent'`. The app will not change that policy. Confirm the env value if public pages must show posts.
3. **Post-merge file list.** Chief of Staff will send the exact marketing-agent-specific code to adapt once #148 and #150 have both merged. Phase B should wait for that list before copying files, even after the migrations are live and Pro is approved.

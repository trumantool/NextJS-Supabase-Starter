# Posts, Stripe Billing & OpenRouter Token Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum net-new pieces so a fork of `trumantool/NextJS-Supabase-Starter` can power a simple local-business site: user profiles with plan/billing fields, a `posts` writing model, Stripe checkout/portal/webhook, and OpenRouter usage tracked on a shared token ledger.

**Architecture:** Schema-in-repo only on the boilerplate Supabase project (`cyczlgdaocwueaacqxsh`). Do **not** apply migrations to live boilerplate DB until Truman lifts hold. Never touch Marketing/Edu shared DB (`glplvrljdgowcwuubkau`). Port ledger + OpenRouter key resolution patterns from marketing-agent (read-only); do not copy Edu `tech_edu_openrouter_*` keys or course parents.

**Tech Stack:** Next.js 15 App Router (`nextjs/`), Supabase Auth + Postgres RLS, Stripe Checkout + Customer Portal + webhooks, OpenRouter.

**Write repo:** https://github.com/trumantool/NextJS-Supabase-Starter  
**Reference only:** `trumantool/marketing-agent`, `trumantool/edu-tutorials`  
**Author (if needed):** Truman Tool \<admin@trumantool.com\>

## Status on main (`46ee4ad`)

This feature set is already on `main` (posts, Stripe, and the token ledger from #14, plus the blog follow-ups). Do not implement it again.

Cleanup PRs #26–#29 are also on `main`:

- The agent-template catalog UI and the automations product (pages, API, and crons) are gone. `nextjs/vercel.json` is `{}`. Do not put those surfaces back while following this plan.
- Blog Phase A is in. The public header label is **Blog** and the path stays `/posts`. Do not rename it to `/blog`. Admin **Blog → My Posts** is `/admin/blog`.
- `admin_settings` uniqueness is `(app_key, option_name)` NULLS NOT DISTINCT (`20261010160000`). Seeds use `ON CONFLICT (app_key, option_name)`. A blank `ADMIN_SETTINGS_APP_KEY` is unscoped.
- `@paddle/*` dependencies are gone.
- Schema files are still not applied to `glplvrljdgowcwuubkau` or the paused starter `cyczlgdaocwueaacqxsh`.

Open PRs #11 (registration provenance) and #12 (post-login redirect) are separate. Each one has to keep working against `main` on its own. Both edit the `schema.sql` admin_settings seed.

## Global Constraints

- Docs/plan first; this plan file is the deliverable for Planning. Implementation is a later Eng task — **do not hand off from this Planning turn**.
- No Composio. OpenRouter + skills only (existing v1 decision).
- No course tools, Studio, YouTube search, reviews, course caps, course pricing cards.
- This plan does **not** add or expand `agent_templates` / `user_agents` / template catalogs (CoS exclude). Cleanup already removed the template catalog UI and the automations product. Leave that removal in place.
- Never re-apply Marketing migrations `20260922100000_user_token_usage.sql`, `20260926130000_llm_models_catalog.sql`, or Edu `edu_openrouter_token_tracking` onto `glplvrljdgowcwuubkau`.
- Do not copy secret key **values**. Seed empty admin setting rows only.
- PRs [#11](https://github.com/trumantool/NextJS-Supabase-Starter/pull/11) and [#12](https://github.com/trumantool/NextJS-Supabase-Starter/pull/12) still edit `handle_new_user`, `admin_settings`, and `schema.sql` on their own branches. This plan does not need another edit there.

---

## Summary

`main` already has auth, files, documents + AI editor, todos, general AI chat, skills, the General and Task Management agents, user/admin settings, **posts**, **Stripe on `user_data`**, and the **shared LLM token ledger** with generic OpenRouter admin keys. Template catalogs, automations, and crons are removed. The net-new work in this document is historical.

## Goals / non-goals

### Goals
1. Extend `user_data` / `user_settings` for profile + plan + Stripe + token totals (columns listed below).
2. Add `public.posts` (not `blog_posts`) with CRUD/admin + public reading suitable for a basic site.
3. Wire Stripe Checkout, Customer Portal, and webhook to keep `user_data` plan fields in sync.
4. Add `llm_models`, `llm_turn_rates`, and `record_llm_turn_usage` (10-arg, no course post id); record usage from existing chat via Marketing’s persist pattern. The automations product is removed, so do not add an automation recording path.
5. Seed generic `admin_settings`: `openrouter_api_key`, `openrouter_force_platform_key`, `openrouter_cost_markup`.

### Non-goals
- Courses, Studio, course_subscriptions, course caps, Edu/Lumenpath product surfaces.
- Agent template catalogs / new `user_agents` work in this plan.
- `brand_profiles`, separate Stripe tables, `blog_posts` table.
- Live DB apply on boilerplate or Marketing.
- Ripping existing agent/chat/documents features off `main` (flag only — see Risks).

## Acceptance criteria

- [ ] Migration(s) in `supabase/migrations/` add only the net-new columns/tables/functions; `schema.sql` stayed in sync.
- [ ] `user_data` has plan/Stripe/token columns; `user_settings` keeps BYOK; profile UI can edit first/last (and shows plan status read-only from Stripe sync).
- [ ] `posts` supports draft/publish, slug, author, optional parent/type for simple page trees; public list/detail + authenticated authoring.
- [ ] Stripe checkout + portal + webhook update `plan`, `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end` only (no course caps).
- [ ] Chat (existing) records turns through `record_llm_turn_usage`; `user_data` totals and `llm_models` aggregates move; `llm_turn_rates` snapshots prices/markup.
- [ ] Admin OpenRouter keys use the three generic names; env `OPENROUTER_API_KEY` remains fallback; BYOK via `user_settings.openrouter_api_key`.
- [ ] No Edu/Marketing secret values committed; no writes to Marketing DB.

## Current state (do not re-spec)

| Area | On `main` today |
|------|-----------------|
| Auth / MFA / settings shell | Yes |
| Files, todos, documents + AI | Yes |
| Chat, skills, General + Task Management agents | Yes. Template catalog UI and automations/crons are **removed** |
| `user_data` | Identity fields plus plan, Stripe, and token totals |
| `user_settings` | first/last/email + `openrouter_api_key` (no separate `name` column) |
| OpenRouter | Env + BYOK + generic admin key trio + ledger (`record_llm_turn_usage`) |
| Posts / blog | Present. Public path `/posts`, nav label **Blog**. Phase A admin list at `/admin/blog` |
| Stripe | Present: checkout, portal, webhook. No `@paddle/*` deps |
| `admin_settings` | Unique `(app_key, option_name)`. Blank `ADMIN_SETTINGS_APP_KEY` stays unscoped |
| Open PRs | #11 provenance and #12 login redirect are separate and still open |

## Gap analysis: keep / adapt / add

| Item | Action |
|------|--------|
| Existing slim features | **Keep** — do not re-spec |
| Profile first/last/email | **Keep** columns; **add** plan/Stripe/token cols; **adapt** settings UI for editable names + plan display |
| CoS `user_settings.name` | **Map** to existing `first_name`/`last_name` (do not add redundant `name` unless product insists) |
| `posts` | **Shipped** — do not add a second posts model |
| Stripe | **Shipped** (columns + API routes + webhook) |
| Token ledger + generic admin keys | **Shipped** (Marketing shape, no course parent) |
| Chat recording path | **Shipped** — chat persist calls `record_llm_turn_usage` |
| `user_agents` / templates | **Leave the cleanup in place.** Do not restore the template catalog or automations |

## Proposed design

### Profile (`user_data` / `user_settings`)
**`user_data` add:** `plan`, `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `total_input_tokens`, `total_output_tokens`, `total_tokens` (bigint defaults 0).  
Keep existing identity fields. Login remains `auth.users`. No `brand_profiles`.

**`user_settings`:** keep `first_name`, `last_name`, `email`, `openrouter_api_key`. Treat CoS “name” as first+last.

Protect token columns with the same privileged-column pattern as Marketing (`protect_user_data_privileged_columns` / `app.allow_token_update`).

### Writing (`public.posts`)
Columns: `id`, `type`, `parent_id`, `title`, `slug`, `summary`, `body`, `video_url`, `cover_image_url`, `sort_order`, `status`, `published_at`, `author_id`, `origin`.  
RLS: public read for published; authors (and admins) write.  
UI: author list/editor + public `/posts` list/detail. The nav label is **Blog**. Do not rename the path to `/blog`. No separate `blog_posts` table.

### OpenRouter keys
`admin_settings` rows (empty secrets):

| option_name | type | default |
|-------------|------|---------|
| `openrouter_api_key` | secret | `''` |
| `openrouter_force_platform_key` | boolean | `'false'` |
| `openrouter_cost_markup` | text | `'0'` |

Resolution pattern (Marketing refs): `openrouter-key.ts` / `openrouter-key-server.ts` — BYOK → admin → env unless force platform. Hide `option_field_type = 'secret'` from anon/authenticated SELECT. Leave `app_settings.openrouter_model` as model id.

### Token ledger
- Tables: `llm_models`, `llm_turn_rates` (parent: `message_id`). The automations product is removed; do not require `automation_run_id` for new recording.
- Also ensure `messages.input_tokens` / `messages.output_tokens`.
- Write path: **only** `record_llm_turn_usage` with **10 args** (no `p_course_post_id`). Do **not** use `increment_user_token_usage*`.
- Platform total = sum of `user_data` totals + `llm_models` aggregates (reporting).
- Optional later: `get_my_llm_usage` / `admin_llm_usage_report` (Marketing versions, no course unions).
- Seed catalog models only if Truman wants a default list; function does not auto-create missing models.

### Stripe
Columns on `user_data` only. Routes: checkout session create, customer portal, webhook (`customer.subscription.*` / `checkout.session.completed` as needed). Map price → `plan` string; sync `plan_status` and `current_period_end`. No course caps. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, price IDs as needed.

## Ordered implementation steps

### Phase 0 — Coordination
- [ ] Do not edit `handle_new_user`, `admin_settings`, or `schema.sql` for this plan. PRs #11 and #12 own those overlaps.
- [ ] Confirm Truman’s hold: schema files only; no live apply to `cyczlgdaocwueaacqxsh`.

### Phase 1 — Schema (migration + schema.sql sync)
- [ ] Add `user_data` plan/Stripe/token columns + privileged protect for tokens.
- [ ] Add `llm_models` (+ picker view, protect trigger), `llm_turn_rates` (two-parent check), 10-arg `record_llm_turn_usage`.
- [ ] Add message (and automation_run if used) token columns if missing.
- [ ] Create `posts` + RLS.
- [ ] Seed three generic OpenRouter `admin_settings` rows (`ON CONFLICT DO NOTHING`).
- [ ] Update `nextjs/src/lib/types.ts`.

### Phase 2 — OpenRouter key resolution + chat recording
- [ ] Port thin TS helpers from Marketing key resolution (generic admin names only).
- [ ] Wire existing chat persist path to insert assistant message then `rpc('record_llm_turn_usage', …)`.
- [ ] Do not wire automations. That product and its crons are removed.
- [ ] Admin UI fields for the three OpenRouter settings (secret masking).

### Phase 3 — Profiles UI
- [ ] Editable first/last on user settings; show plan / status / period end read-only.
- [ ] Do not invent brand profiles.

### Phase 4 — Posts
- [ ] Authoring UI + public published views.
- [ ] Slug uniqueness; draft vs published.

### Phase 5 — Stripe
- [ ] Add Stripe SDK; checkout + portal + webhook.
- [ ] Sync only the listed `user_data` columns.
- [ ] Minimal billing UI (subscribe / manage) — no course pricing cards.

### Phase 6 — Verify (local / preview only)
- [ ] Migration applies cleanly on a **throwaway** local or branch DB (not Marketing; not production boilerplate until hold lifted).
- [ ] One paid test checkout updates plan fields.
- [ ] One chat turn increments user totals + optional `llm_turn_rates` row when model is catalogued.
- [ ] Published post visible anonymously; draft not.

## Data / schema changes (target adds)

**`user_data`:** `plan`, `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `total_input_tokens`, `total_output_tokens`, `total_tokens`

**`posts`:** as listed under Writing

**`llm_models` / `llm_turn_rates` / `record_llm_turn_usage`:** Marketing shared shape without `course_post_id`

**`admin_settings`:** three generic OpenRouter keys

## Risks & open questions

| Item | Note |
|------|------|
| Cleanup already landed | Templates, automations, and crons are removed (#26–#29). Blog Phase A stays. Do not undo that in this plan. |
| `@paddle/*` | Already removed from `package.json`. |
| `user_settings.name` vs first/last | Prefer first/last already on starter. |
| Model catalog seed | Empty catalog ⇒ usage still bumps user totals but skips model aggregates / rate row behavior per function rules — decide seed list at implement time. |
| PRs #11/#12 | Still open, each against `main` on its own. This plan does not stack on them. |
| Live DB hold | Schema-in-repo only until Truman says apply on `cyczlgdaocwueaacqxsh`. |

## Verification / Done-when

1. Plan merged (or PR reviewed) with schema files present.
2. Implementer can follow Phases 0–6 without inventing course/template scope.
3. Fork checklist mentions new env vars (Stripe + existing OpenRouter) and that Marketing DB must never be used.

## Truman skim — net-new only

| Add | Skip / leave |
|-----|----------------|
| Profile plan + Stripe + token columns | brand_profiles |
| `posts` writing model | `blog_posts`, courses, Studio |
| Stripe checkout/portal/webhook | course caps, separate stripe table |
| `llm_models` + `llm_turn_rates` + `record_llm_turn_usage` | Edu course_post_id; `increment_user_token_usage*` |
| Generic admin OpenRouter keys | `tech_edu_openrouter_*`, Marketing secret values |
| Ledger wired into existing chat | Restoring template catalogs, automations, or crons |

## Handoff

Planning deliverable = this file + docs PR. **Do not start implementation from Planning.** Eng handoff is Truman/CoS’s call after review.

# Posts, Stripe Billing & OpenRouter Token Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum net-new pieces so a fork of `trumantool/NextJS-Supabase-Starter` can power a simple local-business site: user profiles with plan/billing fields, a `posts` writing model, Stripe checkout/portal/webhook, and OpenRouter usage tracked on a shared token ledger.

**Architecture:** Schema-in-repo only on the boilerplate Supabase project (`cyczlgdaocwueaacqxsh`). Do **not** apply migrations to live boilerplate DB until Truman lifts hold. Never touch Marketing/Edu shared DB (`glplvrljdgowcwuubkau`). Port ledger + OpenRouter key resolution patterns from marketing-agent (read-only); do not copy Edu `tech_edu_openrouter_*` keys or course parents.

**Tech Stack:** Next.js 15 App Router (`nextjs/`), Supabase Auth + Postgres RLS, Stripe Checkout + Customer Portal + webhooks, OpenRouter.

**Write repo:** https://github.com/trumantool/NextJS-Supabase-Starter  
**Reference only:** `trumantool/marketing-agent`, `trumantool/edu-tutorials`  
**Author (if needed):** Truman Tool \<admin@trumantool.com\>

## Global Constraints

- Docs/plan first; this plan file is the deliverable for Planning. Implementation is a later Eng task — **do not hand off from this Planning turn**.
- No Composio. OpenRouter + skills only (existing v1 decision).
- No course tools, Studio, YouTube search, reviews, course caps, course pricing cards.
- This plan does **not** add or expand `agent_templates` / `user_agents` / template catalogs (CoS exclude). Those already exist on `main` — leave as-is unless Truman asks to remove.
- Never re-apply Marketing migrations `20260922100000_user_token_usage.sql`, `20260926130000_llm_models_catalog.sql`, or Edu `edu_openrouter_token_tracking` onto `glplvrljdgowcwuubkau`.
- Do not copy secret key **values**. Seed empty admin setting rows only.
- Account for open PRs [#11](https://github.com/trumantool/NextJS-Supabase-Starter/pull/11) (registration provenance) and [#12](https://github.com/trumantool/NextJS-Supabase-Starter/pull/12) (`login_redirect_url`) — avoid conflicting `handle_new_user` / `admin_settings` / `schema.sql` edits; land after or rebase onto them.

---

## Summary

Slim extract on `main` already ships auth, files, documents + AI editor, todos, general AI chat, skills, user agents, templates, automations, and user/admin settings. Net-new for a local-business clone is: **profile billing columns**, **`posts` writing**, **Stripe on `user_data`**, and the **shared LLM token ledger** with **generic** OpenRouter admin keys.

## Goals / non-goals

### Goals
1. Extend `user_data` / `user_settings` for profile + plan + Stripe + token totals (columns listed below).
2. Add `public.posts` (not `blog_posts`) with CRUD/admin + public reading suitable for a basic site.
3. Wire Stripe Checkout, Customer Portal, and webhook to keep `user_data` plan fields in sync.
4. Add `llm_models`, `llm_turn_rates`, and `record_llm_turn_usage` (10-arg, no course post id); record usage from existing chat (and automations if cheap) via Marketing’s persist pattern.
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
| Chat, skills, agents, templates, automations | Yes — **out of scope to expand or remove here** |
| `user_data` | `user_id`, role, first/last/email, social URLs — **no** plan/Stripe/tokens |
| `user_settings` | first/last/email + `openrouter_api_key` (no separate `name` column) |
| OpenRouter | Env + BYOK + `app_settings.openrouter_model` — **no** ledger / generic admin key trio |
| Posts / blog | Absent |
| Stripe | Absent (dead `@paddle/*` deps in package.json only) |
| Open PRs | #11 provenance; #12 login redirect |

## Gap analysis: keep / adapt / add

| Item | Action |
|------|--------|
| Existing slim features | **Keep** — do not re-spec |
| Profile first/last/email | **Keep** columns; **add** plan/Stripe/token cols; **adapt** settings UI for editable names + plan display |
| CoS `user_settings.name` | **Map** to existing `first_name`/`last_name` (do not add redundant `name` unless product insists) |
| `posts` | **Add** |
| Stripe | **Add** (columns + API routes + webhook) |
| Token ledger + generic admin keys | **Add** (port Marketing shape, no course parent) |
| Chat recording path | **Adapt** existing chat persist to call `record_llm_turn_usage` |
| `user_agents` / templates | **Leave as-is** (excluded from this plan) |

## Proposed design

### Profile (`user_data` / `user_settings`)
**`user_data` add:** `plan`, `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `total_input_tokens`, `total_output_tokens`, `total_tokens` (bigint defaults 0).  
Keep existing identity fields. Login remains `auth.users`. No `brand_profiles`.

**`user_settings`:** keep `first_name`, `last_name`, `email`, `openrouter_api_key`. Treat CoS “name” as first+last.

Protect token columns with the same privileged-column pattern as Marketing (`protect_user_data_privileged_columns` / `app.allow_token_update`).

### Writing (`public.posts`)
Columns: `id`, `type`, `parent_id`, `title`, `slug`, `summary`, `body`, `video_url`, `cover_image_url`, `sort_order`, `status`, `published_at`, `author_id`, `origin`.  
RLS: public read for published; authors (and admins) write.  
UI: minimal author list/editor + public `/posts` (or `/blog`) list/detail. No separate `blog_posts` table.

### OpenRouter keys
`admin_settings` rows (empty secrets):

| option_name | type | default |
|-------------|------|---------|
| `openrouter_api_key` | secret | `''` |
| `openrouter_force_platform_key` | boolean | `'false'` |
| `openrouter_cost_markup` | text | `'0'` |

Resolution pattern (Marketing refs): `openrouter-key.ts` / `openrouter-key-server.ts` — BYOK → admin → env unless force platform. Hide `option_field_type = 'secret'` from anon/authenticated SELECT. Leave `app_settings.openrouter_model` as model id.

### Token ledger
- Tables: `llm_models`, `llm_turn_rates` (parents: `message_id` **or** `automation_run_id` only — starter already has both).
- Also ensure `messages.input_tokens` / `messages.output_tokens` (and automation_runs token cols if recording automations).
- Write path: **only** `record_llm_turn_usage` with **10 args** (no `p_course_post_id`). Do **not** use `increment_user_token_usage*`.
- Platform total = sum of `user_data` totals + `llm_models` aggregates (reporting).
- Optional later: `get_my_llm_usage` / `admin_llm_usage_report` (Marketing versions, no course unions).
- Seed catalog models only if Truman wants a default list; function does not auto-create missing models.

### Stripe
Columns on `user_data` only. Routes: checkout session create, customer portal, webhook (`customer.subscription.*` / `checkout.session.completed` as needed). Map price → `plan` string; sync `plan_status` and `current_period_end`. No course caps. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, price IDs as needed.

## Ordered implementation steps

### Phase 0 — Coordination
- [ ] Rebase/merge awareness for PRs #11 and #12 before touching `handle_new_user` / `admin_settings` / `schema.sql`.
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
- [ ] Optionally wire automations the same way (same RPC, `p_automation_run_id`).
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
| Agent platform already on main | Chat/Agents/Skills/Templates/Automations + Documents may be **too much** for a thin local-business starter. **Leave as-is** in this plan; Truman can request a later strip plan. |
| Dead `@paddle/*` deps | Hygiene cleanup optional; not Stripe. |
| `user_settings.name` vs first/last | Prefer first/last already on starter. |
| Model catalog seed | Empty catalog ⇒ usage still bumps user totals but skips model aggregates / rate row behavior per function rules — decide seed list at implement time. |
| PRs #11/#12 unstable | Coordinate merges to avoid thrash. |
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
| Wire ledger into existing chat | New template catalogs / user_agents work |

## Handoff

Planning deliverable = this file + docs PR. **Do not start implementation from Planning.** Eng handoff is Truman/CoS’s call after review.

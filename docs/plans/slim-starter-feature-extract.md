# Slim Starter Feature Extract — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `trumantool/NextJS-Supabase-Starter` into a reusable Next.js 15 + Supabase SaaS starter that keeps only: file uploads, Document Creator + AI editing, todos, general AI agent chat with configurable skills, automations for that agent, and the minimal user/admin settings + schema/buckets those need.

**Architecture:** Keep the starter’s auth/MFA, storage, todos, and TipTap+OpenRouter document pattern. Port chat/agents/skills/automations from `trumantool/marketing-agent` as a **generic** (non-ReachThem) slice. Explicitly drop marketing, Composio Ads/SEO catalogs, brand intake, contact/assessment product shells, and Expo from the default web starter path. Prefer adapting in-repo code over wholesale copy when the starter already has the pattern.

**Tech Stack:** Next.js 15 App Router (`nextjs/`), Supabase Auth + Postgres RLS + Storage, TipTap, OpenRouter, Vercel Cron (automations). No dedicated Vercel/Supabase project yet — use **new** project IDs (never Marketing Agent DB `glplvrljdgowcwuubkau` or `marketing-agent-truman`).

**Write repo:** https://github.com/trumantool/NextJS-Supabase-Starter (`main`)  
**Reference only (never write):** `trumantool/marketing-agent`, `onhprojects/supabase-nextjs-starter`  
**Handoff:** Engineer Boilerplate (`a6e80073-72a8-41e5-ad76-5f8684d69709`)

## Global Constraints

- Starter-quality, forkable, documented; no ReachThem / Meta Ads / SEO / Mailchimp product coupling.
- Separate Vercel + Supabase for this boilerplate; never reuse marketing-agent infra or DB.
- Schema must include **only** tables/buckets needed by the keep set (no dead tables).
- Composio Ads/SEO toolkits are **out**. v1 agent = OpenRouter + skills library (+ optional future generic tools stub). Automations = schedule + OpenRouter + skills (no Composio `integrations` dependency).
- Credits: keep simple `user_roles` / admin vs free if already present; prefer **BYOK** (`user_settings.openrouter_api_key`) over complex platform billing. No Paddle wiring required.
- Rename resume-era surfaces to **Documents** in the starter.
- Omit unused `documents`/`resumes` storage bucket if content lives in Postgres JSON (match marketing-agent docs pattern: `documents.doc_json`).
- Do not implement from this plan in marketing-agent. Plan-only handoff to Eng on the starter repo.
- Default branch: `main`. Prefer short-lived PRs.

---

## Summary

Truman wants a slim boilerplate extracted from marketing-agent patterns onto the Razikus-derived starter. The starter already has auth, file storage demo, todos, user/admin settings, and a TipTap+OpenRouter “resume builder.” Marketing-agent has the full keep set but is entangled with ReachThem/Composio/SEO/brand/intake.

This plan defines keep / port / drop, the target schema, and ordered Eng phases.

## Goals / non-goals

### Goals
1. Keep and harden: file upload management, todos, auth/MFA, minimal user + admin settings.
2. Generalize resume builder → Document Creator + AI editing (documents table, generic naming).
3. Port generic AI chat, user agents, agent templates, agent skills library, and automations (+ runs worker/cron).
4. Ship a single coherent `supabase/schema.sql` (and preferably real migrations) with only needed tables/buckets/RLS.
5. Document env vars and fork setup (add `.env.template`).

### Non-goals
- Marketing/ReachThem product features (campaigns, Meta Ads, SEO tooling, Mailchimp, brand questionnaire, intake/assessments).
- Composio integration catalog / Ads toolkits / Treg SEO secrets.
- Writing to marketing-agent, Marketing Agent DB, or upstream `onhprojects/supabase-nextjs-starter`.
- Shipping Expo mobile as part of this extract (leave folder alone or document as optional; do not expand).
- Billing/Paddle, org/company multi-tenancy.
- Implementing the features in this planning PR (Eng implements).

## Acceptance criteria

- [ ] Starter dashboard exposes only keep features (+ auth): Files, Documents, To Do, Chat, Agents/Skills (or equivalent IA), Automations, User Settings, Admin (site + AI model + agent templates as needed).
- [ ] No ReachThem/marketing campaign UI, no Composio Ads/SEO admin, no intake/assessment/contact-product surfaces in the default nav.
- [ ] `supabase/schema.sql` lists only keep tables/buckets; RLS owner-scoped; `handle_new_user` seeds required folders/rows.
- [ ] Documents: create/edit/export + AI panel via OpenRouter; no “resume” user-facing copy.
- [ ] Chat: threads/messages, agent switcher, skills injection for configured agents, optional chat file attachments on `files` bucket.
- [ ] Automations: CRUD + schedule + run history; worker/cron path secured by `CRON_SECRET`; runs with skills + OpenRouter without Composio.
- [ ] `.env.template` documents required keys; README setup matches reality (migrations or explicit schema apply).
- [ ] Fresh fork can stand up against a **new** empty Supabase project without referencing marketing-agent IDs.

## Current state

### NextJS-Supabase-Starter (`main` @ `a1170aa`)
| Area | State |
|------|--------|
| Auth/MFA | Present (`app/auth/**`, MFA components, middleware) |
| Files | Present — `storage/page.tsx`, bucket `files`, helpers in `unified.ts` |
| Todos | Present — `table/page.tsx`, table `todo_list` |
| Documents | Resume TipTap + OpenRouter under `resume-builder/**`; table `resumes`; bucket `resumes` |
| Chat / agents / skills / automations | **Absent** |
| Settings | User profile/password; admin `admin_settings` + `app_settings` |
| Schema | Single `supabase/schema.sql`; **no** `supabase/migrations/`; drift vs types for audio features |
| Docs/plans | **Missing** (this plan creates it) |
| Env template | **Missing** (README claims otherwise) |
| Bloat | contact submissions, assessments/intake, legal editors, Expo template, Paddle deps |

### marketing-agent (read-only reference)
Keep surface already exists under `nextjs/`:
- Files: `/storage`, `user_files` + bucket `user-files` (+ chat attachments on `files`)
- Documents: `/documents/**`, table `documents`, AI via OpenRouter
- Todos: `/table`, `todo_list`
- Chat/agents/skills: `/chat`, `/agents`, `/agent-templates`, `/agent-skills` + tables/buckets
- Automations: `/automations/**` + `automations` / `automation_runs` + cron/worker
- Settings: `/user-settings` (BYOK, MFA), `/admin` (site, AI Docs model, roles, agent templates)

**Entanglement:** chat/automations currently assume Composio toolkits and marketing prompt/brand context — must be stripped or stubbed for starter.

## Gap analysis: keep / port / drop

### KEEP (already in starter — adapt only)
| Feature | Starter paths | Notes |
|---------|---------------|--------|
| Auth + MFA | `nextjs/src/app/auth/**`, MFA components, middleware | Keep |
| File uploads | `…/storage/page.tsx`, `files` bucket | Keep; align naming with marketing `user-files` **or** keep single `files` bucket and document it (prefer **one** private user-files bucket strategy — see design) |
| Todos | `…/table/page.tsx`, `todo_list` | Keep |
| User settings (profile/password) | `…/user-settings/` | Extend for BYOK |
| Admin gate + site settings | `…/admin/` | Slim tabs |
| TipTap + OpenRouter pattern | `resume-builder/**` | Generalize → Documents |

### PORT (from marketing-agent → starter)
| Feature | Primary marketing-agent sources | Notes |
|---------|----------------------------------|--------|
| Documents model | `documents` table, `/documents/**`, AI routes | Prefer porting docs model over leaving `resumes` naming |
| Chat | `app/(dashboard)/chat/**`, `api/chat*`, `api/chats*`, `components/chat/*` | Strip campaign empty-states / Composio-required paths |
| User agents | `/agents`, `user_agents`, clone helpers | Keep |
| Agent templates | `/agent-templates`, admin templates APIs | Keep admin catalog |
| Agent skills | `/agent-skills`, `agent_skills` table, `agent-skills` bucket | Keep |
| Automations | `/automations/**`, worker/cron libs, `automations` + `automation_runs` | Strip Composio integrations requirement |
| BYOK + AI model admin | `user_settings.openrouter_api_key`, `app_settings.openrouter_model` | Keep |
| Chat attachments | `lib/chat-storage.ts`, bucket `files` | Keep if chat kept |
| Agent memory | `agent-memory` bucket | Include for agent parity |

### DROP (do not port / remove from starter default)
| Area | Action |
|------|--------|
| ReachThem / marketing homepage copy | Replace with generic starter landing |
| Composio Ads/SEO toolkits, `/integrations`, admin Composio auth-config IDs | Out of v1 |
| SEO Agent seeds, Treg `user_custom_secrets` SEO paths | Out |
| Brand questionnaire / `brand_profiles` | Out (optional later as generic “user context”) |
| Intake / assessments / audio-text | Remove from starter nav + schema |
| Contact submissions product + admin inbox | Remove from slim schema/nav (or leave dormant — prefer remove) |
| Expo template expansion | Non-goal |
| Paddle billing | Non-goal |
| Unused `documents`/`resumes` storage bucket if unused by editor | Omit |
| marketing-agent Ads-centric plans under `.github/skills/app-build-plans` | Do not follow blindly |

## Proposed design

### Product IA (dashboard)
1. Dashboard home (generic quick links)
2. Files (`/storage`)
3. Documents (`/documents`)
4. To Do (`/table` or rename route to `/todos` — Eng choice; update nav label)
5. Chat (`/chat`)
6. Agents (`/agents`) + Skills (`/agent-skills`) + Templates (`/agent-templates`)
7. Automations (`/automations`)
8. User Settings (`/user-settings`) — profile, password, MFA, OpenRouter BYOK
9. Admin — Site settings (title/url/support), AI Docs model, Agent templates, optional Roles

### Storage strategy (decision)
Use **two** private buckets for clarity matching marketing-agent chat/files split, **or** one `files` bucket with path conventions. **Recommendation:**
- `user-files` — My Files UI (`{userId}/…`)
- `files` — chat attachments (`{userId}/chat-attachments/{chatId}/…`)
- `agent-skills` — skill markdown (`shared/` + per-user)
- `agent-memory` — per-user agent memory
- **No** dedicated documents/resumes storage bucket (content in `documents.doc_json`)

If Eng prefers minimal churn from current starter, keep existing `files` for My Files and still add chat path prefix + `agent-skills` / `agent-memory`. Document the choice in README. **Preferred:** rename My Files to `user-files` for parity with marketing-agent port paths.

### Data model (keep-only)

**Core:** `user_data`, `user_settings` (incl. `openrouter_api_key`), `user_roles` (simple), `admin_settings`, `app_settings`

**Product:** `user_files`, `todo_list`, `documents` (replace `resumes`)

**Agent platform:** `chats`, `messages`, `session_tags`, `chat_tags`, `user_agents`, `agent_templates`, `agent_skills`, `automations`, `automation_runs`

**Helpers:** `authenticative.is_user_authenticated()`, `handle_new_user` (seed user rows + storage folders)

**Explicitly not in schema:** contact_submissions, text/audio assessments, brand_profiles, composio auth-config tables, SEO agent seeds, user_connections (unless a future generic tools phase)

### AI runtime (v1)
- OpenRouter only (`OPENROUTER_API_KEY` + optional BYOK).
- Skills: load markdown from `agent-skills` by `skill_ids` for agents and automations (same helper pattern as marketing-agent `automation-skills` / agent-runtime).
- No Composio tool loop in v1. Chat approval cards for external tools can be deferred or left as no-op stubs.
- Automations: Postgres queue + `/api/cron/automations` + `/api/workers/automations` with `CRON_SECRET` + service role; schedule fields without requiring `integrations` jsonb for Ads.

### Documents
- Port/generalize to `documents` (`title`, `template`, `doc_json`, `model`).
- User-facing “Documents”; rename resume components/APIs over time (can be one PR phase).
- AI panel → documents AI route; admin “AI Docs” sets default model in `app_settings`.

## Ordered implementation steps

### Phase 0 — Repo hygiene (Eng first PR)
- [x] Create `docs/plans/` (this file already lands here).
- [x] Add `nextjs/.env.template` with required keys (no secrets).
- [x] Fix README: remove false claims (missing ZH docs/migrations); document schema apply path.
- [x] Decide migrations approach: **v1 applies `supabase/schema.sql` once** (no `supabase/migrations/` yet). A Phase 0 split of the current dump is not useful; Phase 1 will introduce real migrations with the slim keep-only schema.
- [x] Confirm Cursor cloud agent access to `trumantool/NextJS-Supabase-Starter` (expected OK). Escalate if blocked.

### Phase 1 — Schema slim + prune dead product
- [x] Rewrite `supabase/schema.sql` to keep-only tables/buckets/RLS listed above.
- [x] Replace `resumes` with `documents` (migration path for empty starter: drop resume table if unused in forks).
- [x] Remove assessment/contact tables from schema; remove or hide their routes from AppLayout.
- [x] Update `nextjs/src/lib/types.ts` to match schema (fix audio drift).
- [x] Seed `handle_new_user` for `user-files` / `agent-skills` folders as needed.
- [ ] Verification: apply schema to a throwaway Supabase project; no errors; RLS smoke via anon/authenticated.

### Phase 2 — Keep surfaces harden (files, todos, settings)
- [x] Align Files UI with chosen bucket naming; keep upload/list/delete/signed URL.
- [x] Todos: ensure CRUD + RLS; optional rename `/table` → `/todos`.
- [x] User settings: add BYOK field + API pattern from marketing-agent (`/api/user/byok-key` or equivalent).
- [x] Admin: slim to site settings + openrouter model; drop submissions tab.
- [x] Strip public marketing/ReachThem copy to generic starter branding (`NEXT_PUBLIC_PRODUCTNAME`).

### Phase 3 — Documents generalization
- [x] Move `resume-builder` → `documents` routes/components (or alias then delete).
- [x] Persist to `documents` table; AI + export + models + settings routes.
- [x] Remove resume-specific template assumptions where easy; keep TipTap JSON doc model.
- [x] Admin AI Docs points at documents model setting.
- [ ] Verification: create/edit/AI-suggest/export a document as signed-in user.

### Phase 4 — Agent skills + templates + user agents
- [x] Port `agent_skills` / `agent_templates` / `user_agents` schema already in Phase 1.
- [x] Port Skills Library UI + APIs (upload/list; shared vs mine); bucket `agent-skills`.
- [x] Port Agent Templates (user gallery + admin CRUD).
- [x] Port User Agents (create/edit, skill_ids, model_id, clone from template).
- [x] Do **not** port SEO/Ads template seeds — ship 0–1 generic starter templates only.
- [ ] Verification: create skill, clone template → user agent, assign skills.

### Phase 5 — General AI chat
- [x] Port chat UI + `chats`/`messages` APIs.
- [x] Wire OpenRouter generation path **without** Composio tool execution (skills-as-system-context is enough for v1).
- [x] Agent switcher; tags optional but tables exist if porting tags UI is cheap.
- [x] Chat attachments on `files` bucket.
- [x] Replace campaign empty-state copy with generic prompts.
- [ ] Verification: multi-turn chat; chat with agent that has skills; attachment upload.

### Phase 6 — Automations
- [x] Port automations CRUD UI + `automations` / `automation_runs`.
- [x] Port schedule helpers + worker; secure cron with `CRON_SECRET`.
- [x] `vercel.json` cron entries — set a sensible wake cadence; document that wake ≠ execute if using queue pattern (see marketing-agent `docs/plans/automations.md` as reference only).
- [x] Run path: load skills + OpenRouter; **no** Composio integrations required; `allow_mutations` may remain as a future flag defaulting false.
- [ ] Verification: create automation, enqueue run, observe run history transcript.

### Phase 7 — Forkability polish
- [ ] README: feature list, schema apply, env vars, cron secrets, “new Supabase project” checklist.
- [ ] Grep for ReachThem / marketing-agent project IDs / `OPENROUTER_API_KEY_REACHTHEMAI` and neutralize.
- [ ] Optional: remove Expo from default docs path; leave folder with “unsupported in slim web starter” note.
- [ ] Done-when checklist below all green.

## Data / schema changes (target)

### Tables (keep)
`user_data`, `user_settings`, `user_roles` (if used), `admin_settings`, `app_settings`, `user_files`, `todo_list`, `documents`, `chats`, `messages`, `session_tags`, `chat_tags`, `user_agents`, `agent_templates`, `agent_skills`, `automations`, `automation_runs`

### Buckets (keep)
`user-files`, `files`, `agent-skills`, `agent-memory`

### Drop from starter schema
`resumes` (replaced by `documents`), `contact_submissions`, assessment tables, any Composio/SEO/brand-specific tables if present after ports

### RLS
Owner-scoped policies; storage MFA-aware via `authenticative.is_user_authenticated()` and path prefix `auth.uid()`.

## Risks & open questions

| Risk / question | Recommendation | Escalate? |
|-----------------|----------------|-----------|
| Composio in/out | **Out of v1**; skills+OpenRouter only | Confirm with CoS/Truman if they expected toolkits |
| Credits complexity | Simple roles + BYOK | No unless Truman wants platform credits |
| Bucket rename `files` → `user-files` | Prefer rename for port clarity; increases churn | Eng can keep `files` if lower risk |
| Agent memory v1 | **Include** bucket + minimal wiring | Soft |
| Cron cadence | Document + pick ≥5m practical schedule | Soft |
| Schema-only vs migrations | Prefer migrations for forks | Soft |
| Large port PRs | Follow phases 0→7; each phase shippable | No |
| Cursor GitHub access | Write repo currently accessible to `trumantool` | Escalate to CoS if cloud agent cannot open PR |
| marketing-agent entanglement | Never copy Composio catalog or SEO seeds | No |

## Verification / Done-when

1. Fresh Supabase project + env from `.env.template` boots `nextjs` locally.
2. Sign up → MFA optional → see slim nav only.
3. Upload/list/delete file; create/complete todo; create document + AI edit.
4. Create skill + agent; chat with agent; run automation once (cron or manual run endpoint).
5. Admin can set site title/url and default OpenRouter model; manage agent templates.
6. `schema.sql` (or migrations) contains no assessment/contact/Composio/SEO residue.
7. README fork checklist works without marketing-agent secrets or project IDs.

## Keep / port / drop (Truman skim card)

| Item | Action |
|------|--------|
| Auth / MFA | **Keep** (starter) |
| File uploads | **Keep** (starter; align buckets) |
| Todos | **Keep** (starter) |
| Document Creator + AI edit | **Adapt** starter resume builder → documents; **port** docs model/UX from marketing-agent as needed |
| AI chat + skills + agents/templates | **Port** from marketing-agent (genericize) |
| Automations | **Port** from marketing-agent (no Composio) |
| User/admin settings needed by above | **Keep** + **port** BYOK / AI model / agent-template admin |
| Marketing, Composio Ads/SEO, brand, intake, assessments, contact product, Expo focus, Paddle | **Drop** |
| Schema/buckets | **Only** what the keep set needs |

## Handoff

When this plan is merged (or on the PR):
- Owner: **Engineer Boilerplate**
- Start at **Phase 0**, then 1→7
- Do not implement inside Planning Boilerplate
- Escalate product calls (especially Composio-in-v1) to **Chief of Staff Boilerplate**

## Reference paths (read-only)

Marketing-agent plans useful as pattern references (not requirements):  
`docs/plans/automations.md`, `docs/plans/automation-skills.md`, and historical `.github/skills/app-build-plans/**` (Ads-centric — filter heavily).

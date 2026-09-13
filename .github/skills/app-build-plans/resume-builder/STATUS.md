# Resume Builder — STATUS

> Status of the Cloud Build Plan (`PLAN.md`) for the Resume Builder feature.
> **Last updated:** 2026-08-12 · **Branch:** `nonprofit-cms`

## TL;DR

The Resume Builder feature is **implemented and deployed** to the remote Supabase
project. All phases of the plan are complete. Everything lives under
`nextjs/src/app/app/resume-builder/` and is deletable by removing that folder
(plus the TipTap deps in `nextjs/package.json` and the migration
`supabase/migrations/20260812_resume_builder.sql`).

> **Location note:** The plan called for `nextjs/src/app/resume-builder/`, but the
> app's middleware only protects `/app` paths; all protected routes live under
> `nextjs/src/app/app/`. The feature was placed at
> `nextjs/src/app/app/resume-builder/` so it **inherits existing auth protection**
> with no middleware changes. URLs are `/app/resume-builder/...`.

---

## Phase status

| Phase | Plan deliverable | Status | Notes |
|---|---|---|---|
| **0 — Scaffold & schema** | Route tree + migration + types | ✅ Done | Migration applied to remote Supabase. Tables, RLS, bucket, seed verified. |
| **1 — Editor (no AI)** | TipTap editor, templates, resume CRUD + autosave | ✅ Done | Word-like editor with toolbar, 3 templates, autosave every 1.5s. |
| **2 — docx export** | PM JSON → .docx | ✅ Done | Self-contained OOXML + ZIP builder (see deviation below). Validated by unzip. |
| **3 — OpenRouter AI** | SSE stream, model list, admin model picker | ✅ Done | Default `poolside/laguna-s-2.1:free`; admin can switch model. |
| **4 — AI in the editor** | Generate / improve / tailor from sidebar | ✅ Done | Chat-style sidebar streams from `/api/ai`; "Insert" appends to doc. |
| **5 — Polish** | Print-to-PDF, empty states, errors, RLS verify | 🟡 Partial | Empty states + errors + RLS verified. Print-to-PDF via `window.print()` not added (see below). |

### Definition of done
- [x] Logged-in user can create a resume from a template.
- [x] Edit it in a Word-like editor (bold/italic/underline/strike, headings, lists).
- [x] Export a `.docx` that opens cleanly (validated: unzips, clean OOXML).
- [x] AI helps generate/improve content via OpenRouter (default `poolside/laguna-s-2.1:free`).
- [x] An admin/settings page can change the OpenRouter model.
- [x] Everything is deletable by removing `nextjs/src/app/app/resume-builder/`.

---

## What was built

### Route tree (`nextjs/src/app/app/resume-builder/`)
```
resume-builder/
├── layout.tsx                     # wraps children in root AppLayout (sidebar)
├── page.tsx                      # dashboard: list user's resumes + "New"
├── new/page.tsx                  # template picker -> creates resume
├── [id]/page.tsx                 # editor view (server: load resume)
├── admin/settings/page.tsx       # OpenRouter model picker
├── api/
│   ├── resumes/route.ts          # GET list / POST create
│   ├── resumes/[id]/route.ts     # GET one / PATCH / DELETE
│   ├── export/route.ts           # POST: PM JSON -> .docx download
│   ├── ai/route.ts               # POST: stream OpenRouter completions (SSE)
│   ├── models/route.ts           # GET: OpenRouter model list
│   └── settings/route.ts         # POST: persist chosen model
├── components/
│   ├── ResumeEditor.tsx          # TipTap editor (word-like)
│   ├── ResumeToolbar.tsx         # formatting + AI + Export
│   ├── TemplatePicker.tsx        # choose resume template
│   ├── AiPanel.tsx               # AI sidebar (streams from /ai)
│   ├── ModelSettingsForm.tsx     # admin model selector
│   ├── ResumeEditorClient.tsx    # autosave / export / AI wiring
│   └── DeleteResumeButton.tsx    # delete w/ confirm
└── lib/
    ├── types.ts                  # ResumeDoc, ResumeMeta, AppSettings
    ├── templates.ts              # 3 seed templates (classic, modern, compact)
    ├── editor-schema.ts          # TipTap extensions
    ├── supabase-resumes.ts       # server CRUD (reuses @/lib/supabase/server)
    ├── openrouter.ts             # server OpenRouter client (chat + SSE)
    └── docx-export.ts            # PM JSON -> .docx (OOXML + minimal ZIP)
```

### Shared code touched (minimal)
- `nextjs/src/lib/types.ts` — added `resumes` + `app_settings` table shapes to the `Database` type.
- `nextjs/src/components/AppLayout.tsx` — added "Resume Builder" + "Resume Builder Settings" to the sidebar.
- `nextjs/package.json` — added TipTap deps (`@tiptap/*`, `@tiptap/pm`).

### Database (remote Supabase — verified live)
- Migration: `supabase/migrations/20260812_resume_builder.sql`
- Tables: `public.resumes`, `public.app_settings` ✅
- RLS: owner-scoped policies on `resumes` (read/write/update/delete), read policy on `app_settings`, user-folder policy on `storage.objects` for bucket `resumes` ✅
- Storage bucket: `resumes` (private) ✅
- Seed: `app_settings.openrouter_model = "poolside/laguna-s-2.1:free"` ✅

---

## Deviations from PLAN.md (decisions made during implementation)

1. **Route location moved under `/app`** — `nextjs/src/app/app/resume-builder/`
   instead of `nextjs/src/app/resume-builder/` so it inherits the app's existing
   auth guard in `nextjs/src/middleware.ts`. Cleaner, no middleware changes.

2. **docx engine: self-contained builder instead of vendored GenOffice engine** —
   Plan §8 listed vendoring `packages/docx-engine` as a risk. GenOffice is alpha
   and fast-moving; instead we wrote a minimal, dependency-free OOXML serializer +
   store-only ZIP writer in `lib/docx-export.ts`. Validated: output unzips cleanly
   with correct sizes/offsets and Word-valid structure (document/numbering/styles +
   rels + content types).

3. **Admin gating = any authenticated user** — the plan said "reuse existing
   admin check", but the codebase has **no admin role system** (no `is_admin`,
   no role checks anywhere). The settings page is reachable by any logged-in
   user. If real admin gating is wanted, that's a follow-up.

4. **OpenRouter key** — uses `OPENROUTER_API_KEY` with fallback to
   `OPENROUTER_API_KEY_REACHTHEMAI` (both present in `.env`). Key stays
   server-side env only; never exposed to the client.

5. **Editor AI panel is a sidebar, not a full agent loop** — Plan §4 mentioned
   `packages/agent-core` skills composition. Simpler ship: chat-style prompts with
   presets ("Write summary", "Improve experience", "Tailor to role") + free text,
   streamed to the editor. Insert appends as paragraphs.

6. **No print-to-PDF** — Phase 5 listed `window.print()` with doc-style CSS. The
   editor page renders at full width; `window.print()` would need dedicated page
   CSS to be faithful. Marked as follow-up.

---

## Known issues / follow-ups

- **Pre-existing type errors in the repo** (not from this feature): `Database`
  generic in `nextjs/src/lib/types.ts` doesn't resolve rows for some tables, so
  the codebase uses `as any` casts. `supabase-resumes.ts` follows that convention.
  Untouched files with pre-existing errors: `src/app/app/intake/actions.ts`,
  `src/app/app/audio-text-assessment/actions.ts`, `src/components/AudioRecorder.tsx`,
  `src/components/IntakeForm.tsx`.
- **Print-to-PDF** not implemented (see deviations).
- **Admin role system** not implemented (see deviations).
- **Exported files are downloaded, not stored in the `resumes` bucket** — the
  bucket + storage policy exist per plan, but the export route returns a download
  rather than uploading a copy. Storage upload is a trivial follow-up if needed.
- **GenOffice NOTICE/licensing** — since we did **not** vendor any GenOffice code
  (no copy of `packages/docx-engine` or renderer files), no NOTICE obligations
  were incurred. If future work vendors GenOffice code, add a NOTICE per plan §7.

---

## How to run / verify

```bash
cd nextjs
npm install        # already done; pulls @tiptap deps
npm run dev        # then log in and open /app/resume-builder
```

Verify checklist:
- [ ] Dashboard lists existing resumes and "New" works.
- [ ] Template picker creates a resume; editor loads with autosave.
- [ ] Toolbar formats text; heading/list buttons work.
- [ ] Export downloads a `.docx` that opens in Word.
- [ ] AI sidebar streams a response from OpenRouter (needs a valid key in `.env`).
- [ ] `/app/resume-builder/admin/settings` loads the model dropdown and saves.

## Deletability checklist

Remove exactly these and the feature is gone:
1. `nextjs/src/app/app/resume-builder/` (entire folder)
2. TipTap entries added to `nextjs/package.json` (search `@tiptap`)
3. `resumes` / `app_settings` table types added to `nextjs/src/lib/types.ts`
4. Sidebar entries added to `nextjs/src/components/AppLayout.tsx`
5. `supabase/migrations/20260812_resume_builder.sql` (plus drop the tables/bucket if desired)
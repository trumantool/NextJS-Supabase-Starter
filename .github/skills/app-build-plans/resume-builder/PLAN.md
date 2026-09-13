# Resume Builder — Cloud Build Plan

**Goal:** Add a 100% cloud-based **Resume Builder** to this Next.js 14 + Supabase app, reusing
GenOffice's word-processor engine/editor where possible, and powering AI features with
**OpenRouter** (default model `poolside/laguna-s-2.1:free`).

**Why GenOffice:** It is Apache-2.0 and its word processor is split into a *pure-TypeScript
engine* (`packages/docx-engine`, no Electron) plus a *React/ProseMirror web editor*
(`apps/docs/src/renderer`). That split is exactly what lets us run it in the browser/Next.js
instead of the Electron desktop shell.

**Deletability:** ALL new code lives under `nextjs/src/app/resume-builder/` (route folder with
colocated `components/`, `lib/`, `api/`). Delete that one folder and the feature is gone. No
changes to root config, `package.json` deps outside that folder's own `package.json` (if any),
or shared layouts are required.

---

## 1. Architecture

```mermaid
flowchart TD
  Browser[Resume Builder UI<br/>nextjs/src/app/resume-builder] -->|React/ProseMirror editor| Editor[ResumeEditor.tsx]
  Editor -->|ProseMirror JSON| API_AI[/api/resume-builder/ai]
  Editor -->|ProseMirror JSON| API_EXPORT[/api/resume-builder/export]
  API_AI -->|OpenRouter SDK / fetch| OR[OpenRouter API<br/>poolside/laguna-s-2.1:free]
  API_EXPORT -->|docx-engine (pure TS)| DOCX[.docx bytes]
  DOCX --> SB[Supabase Storage<br/>bucket: resumes]
  Editor -->|autosave JSON| API_RESUME[/api/resume-builder/resumes]
  API_RESUME --> PG[(Supabase Postgres<br/>table: resumes)]
  Admin[Admin Settings Page] -->|select model| API_MODELS[/api/resume-builder/models]
  API_MODELS --> OR
  Admin -->|persist choice| PG
```

**Key principle:** GenOffice's `apps/docs` renderer already runs under a Vite dev server
(`apps/docs/vite.renderer.config.ts` = "renderer-only dev server… no standalone Electron"). We
reuse that renderer code but **swap the Electron bridge** (`window.desktop` → our API client) and
**swap the AI backend** (Genspark → OpenRouter).

---

## 2. Folder layout (everything under `nextjs/src/app/resume-builder/`)

```
nextjs/src/app/resume-builder/
├── layout.tsx                     # route layout (reuses root AppLayout)
├── page.tsx                      # dashboard: list user's resumes + "New"
├── new/page.tsx                  # template picker -> creates resume
├── [id]/page.tsx                 # editor view (server: load resume, pass to client editor)
├── admin/settings/page.tsx       # admin: pick OpenRouter model (default poolside/laguna-s-2.1:free)
├── api/
│   ├── resumes/route.ts          # GET list / POST create / PATCH update (Supabase)
│   ├── resumes/[id]/route.ts     # GET one / DELETE
│   ├── export/route.ts           # POST: ProseMirror JSON -> .docx (docx-engine, server-side)
│   ├── ai/route.ts               # POST: stream OpenRouter completions (SSE)
│   └── models/route.ts           # GET: OpenRouter model list (admin dropdown)
├── components/
│   ├── ResumeEditor.tsx          # 'use client' TipTap/ProseMirror editor
│   ├── ResumeToolbar.tsx         # formatting + AI actions + Export
│   ├── TemplatePicker.tsx        # choose resume template
│   ├── AiPanel.tsx               # chat/generate/improve sidebar (streams from /ai)
│   └── ModelSettingsForm.tsx     # admin model selector
└── lib/
    ├── types.ts                  # ResumeDoc, ResumeMeta, AppSettings
    ├── openrouter.ts             # server: OpenRouter client (chat + stream)
    ├── docx-export.ts            # server: wraps packages/docx-engine
    ├── supabase-resumes.ts       # server: CRUD helpers (reuses ../lib/supabase/server)
    └── editor-schema.ts          # TipTap/ProseMirror schema (ported from docs extensions)
```

Reuse existing Supabase clients (do NOT recreate):
- `nextjs/src/lib/supabase/server.ts` (server client)
- `nextjs/src/lib/supabase/client.ts` (browser client)
- `nextjs/src/lib/supabase/middleware.ts` + `nextjs/src/middleware.ts` (auth/session)

---

## 3. Code to borrow from GenOffice (with reference URLs)

| What we need | GenOffice source (URL) | What to extract |
|---|---|---|
| **docx generation engine** (pure TS, no Electron) | `https://github.com/genspark-ai/genoffice/blob/main/packages/docx-engine/src/index.ts` | The OOXML block-tree → `.docx` serializer. Run it **server-side** in `api/export/route.ts`. |
| Equation/OMML support (optional) | `https://github.com/genspark-ai/genoffice/blob/main/packages/docx-engine/src/math.ts` | `latexToOmml` / `ommlToMathML` if we want equations. |
| Editor schema & extensions | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/editor/extensions.ts` | ProseMirror/Tiptap node + mark definitions (paragraphs, headings, lists, tables, images). Port into `lib/editor-schema.ts`. |
| Editor ↔ docx block model | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/editor/convert.ts` | `blocksToPmDoc`, `pmDocToSavePlan`, `PmNode` — convert ProseMirror doc to the engine's save plan. |
| Save/open flow logic | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/file-actions.ts` | The orchestration of "editor state → save plan → engine". Replace file I/O with Supabase calls. |
| Word-like page CSS | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/doc-style-css.ts` | `docStyleCss` for print-accurate pagination in the editor preview. |
| Editor state model | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/doc-state.ts` | `DocState`, section/header-footer types to model a resume document. |
| Simpler Tiptap bootstrap | `https://github.com/genspark-ai/genoffice/blob/main/apps/markdown/src/renderer/` | The Markdown app is a cleaner Tiptap starting point than full Docs; copy its editor bootstrap. |
| AI transport pattern | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/ai/transport.ts` | `createIpcTransport` / `AgentTransport` shape — we re-implement the *same interface* over `fetch` to OpenRouter. |
| Agent loop / skills | `https://github.com/genspark-ai/genoffice/blob/main/packages/agent-core` | `AgentTransport` + skill composition pattern to structure AI "generate/improve section" tools. |
| AI request/stream types | `https://github.com/genspark-ai/genoffice/blob/main/packages/ai-provider` | `AiChatRequest`, `AiStreamRequest`, `AiStreamChunk`, `AiSettings` — reuse as our typed contract (swap provider internals). |
| UI kit / design tokens | `https://github.com/genspark-ai/genoffice/blob/main/packages/ui` | `tokens.css` + component primitives for a consistent look (optional; our app already has `components/ui`). |
| i18n scaffolding (optional) | `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/renderer/i18n/locale.ts` | Only if we need multi-language resumes. |

### What we DO NOT use (Electron-only, drop entirely)
- `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/preload/index.ts` — the `contextBridge`/`ipcRenderer` desktop bridge. **Replace** with a `ResumeApi` client that calls our own `/api/resume-builder/*` routes.
- `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/shared/ipc.ts` — the `DesktopApi` IPC contract. **Replace** with our own typed client contract.
- `https://github.com/genspark-ai/genoffice/blob/main/apps/docs/src/main/docs-main.ts` — main-process file I/O, `printToPDF`, auto-updater. **Drop**; use Supabase Storage + browser `window.print()` for PDF.
- `https://github.com/genspark-ai/genoffice/blob/main/packages/ai-search` — Genspark device-code auth + proprietary cloud. **Replace** with OpenRouter key from admin settings / env.
- `https://github.com/genspark-ai/genoffice/blob/main/packages/project-store` — local JSONL chat store. **Replace** with Supabase (resume rows + optional chat history table).

---

## 4. OpenRouter integration

Reference: **https://openrouter.ai/docs/quickstart**

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Auth:** `Authorization: Bearer ${OPENROUTER_API_KEY}` (server-side only; never expose key to client).
- **Streaming:** `stream: true` → Server-Sent Events; proxy through `api/ai/route.ts` as SSE to the browser `AiPanel`.
- **Default model:** `poolside/laguna-s-2.1:free` (set in `lib/openrouter.ts` and as the seeded `app_settings` row).
- **Model list:** `GET https://openrouter.ai/api/v1/models` → feed the admin dropdown in `api/models/route.ts` + `ModelSettingsForm.tsx`.
- **Key storage:** `OPENROUTER_API_KEY` in `.env` (already present in this workspace `.env`). Admin-selected *model id* persists in a `app_settings` table row; the *key* stays server-side env only.

`lib/openrouter.ts` mirrors the `AgentTransport` interface from
`apps/docs/src/renderer/ai/transport.ts` but calls OpenRouter via `fetch` instead of
`window.desktop.aiStream`.

---

## 5. Supabase schema (new, isolated to this feature)

```sql
-- Storage bucket
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false);

-- Metadata table
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Resume',
  template text not null default 'classic',
  doc_json jsonb not null default '{}'::jsonb,   -- ProseMirror document
  model text not null default 'poolside/laguna-s-2.1:free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.resumes enable row level security;

create policy "owner read"   on public.resumes for select using (auth.uid() = user_id);
create policy "owner write"  on public.resumes for insert with check (auth.uid() = user_id);
create policy "owner update" on public.resumes for update using (auth.uid() = user_id);
create policy "owner delete" on public.resumes for delete using (auth.uid() = user_id);

-- Admin-chosen global default model (single row)
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value)
values ('openrouter_model', '"poolside/laguna-s-2.1:free"');

-- Storage policy: users only touch their own folder
create policy "resume owner" on storage.objects
  for all using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
```

Add a migration under `supabase/migrations/` (e.g. `20260812_resume_builder.sql`) following the
repo's existing migration convention.

---

## 6. Phased implementation (for the coding agent)

**Phase 0 — Scaffold & schema**
1. Create `nextjs/src/app/resume-builder/` tree above.
2. Add `supabase/migrations/20260812_resume_builder.sql` (schema above) and apply locally/remotely.
3. `lib/types.ts` with `ResumeDoc`, `ResumeMeta`, `AppSettings`.

**Phase 1 — Editor (no AI yet)**
4. Port editor schema from `apps/docs/src/renderer/editor/extensions.ts` (+ bootstrap from
   `apps/markdown/src/renderer/`) into `lib/editor-schema.ts` and `ResumeEditor.tsx`.
5. `TemplatePicker.tsx` + seed 2–3 resume templates (classic, modern, compact) as ProseMirror JSON.
6. `api/resumes/route.ts` + `lib/supabase-resumes.ts` for CRUD; wire autosave from the editor.

**Phase 2 — docx export**
7. Vendor `packages/docx-engine` (copy `src/` into `lib/docx-engine/` or add as a git submodule
   reference) — it is pure TS, no Electron.
8. `lib/docx-export.ts`: ProseMirror JSON → `pmDocToSavePlan` (from `editor/convert.ts`) →
   docx-engine serializer → `.docx` bytes.
9. `api/export/route.ts`: returns the `.docx` (download) and/or stores it in the `resumes` bucket.

**Phase 3 — OpenRouter AI**
10. `lib/openrouter.ts`: chat + SSE stream client (default `poolside/laguna-s-2.1:free`).
11. `api/ai/route.ts`: proxies streaming to the browser; `api/models/route.ts`: lists OpenRouter models.
12. `admin/settings/page.tsx` + `ModelSettingsForm.tsx`: admin picks model → saves to `app_settings`.
    Gate with existing admin/auth check (reuse `middleware.ts` session logic).

**Phase 4 — AI in the editor**
13. `AiPanel.tsx`: "Generate from prompt", "Improve section", "Tailor to job description" — all
    streamed from `/api/resume-builder/ai` using the selected model. Reuse the `AgentTransport`
    shape from `apps/docs/src/renderer/ai/transport.ts` / `packages/agent-core`.

**Phase 5 — Polish**
14. Print-to-PDF via `window.print()` with `doc-style-css.ts` page styling.
15. Empty states, loading, error boundaries, RLS verification.

---

## 7. License & compliance
- GenOffice core is **Apache-2.0** (only `ee/` differs, and it is empty). We may use/modify it
  commercially. Obligations: retain `LICENSE`/`NOTICE`, state changes, and **do not use the
  "GenOffice"/"Genspark" names or logos** (Apache-2.0 §6). Rebrand as our Resume Builder.
- Keep a `NOTICE` file in `resume-builder/` crediting GenOffice + its third-party licenses
  (the repo's `tools/gen-third-party-notices.mjs` output lists them).

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| docx-engine expects some Node APIs | Run export **server-side** in route handlers; avoid browser-only APIs. |
| Editor bridge is deeply tied to `window.desktop` | Build a thin `ResumeApi` client with the same method names; only the transport changes. |
| Word-faithful pagination needs main-process font metrics | Accept browser-font metrics; resumes are short, pagination differences are acceptable. |
| GenOffice is alpha / fast-moving | Vendor a pinned commit of `packages/docx-engine`; avoid depending on `apps/docs` internals beyond the listed files. |
| OpenRouter model availability | Default to `poolside/laguna-s-2.1:free`; admin can switch; cache model list. |

## 9. Definition of done
- A logged-in user can create a resume from a template, edit it in a Word-like editor, export a
  `.docx` that opens cleanly in Microsoft Word, and have AI help generate/improve content via
  OpenRouter (default `poolside/laguna-s-2.1:free`).
- An admin can change the OpenRouter model from a settings page.
- Everything is deletable by removing `nextjs/src/app/resume-builder/`.

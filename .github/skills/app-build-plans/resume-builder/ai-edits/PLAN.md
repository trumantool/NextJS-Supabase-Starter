# Resume Builder — AI Edits Build Plan

**Goal:** Upgrade the existing resume-builder AI sidebar from *append-only* generation to a
full **AI editing loop**: (1) write a complete resume from scratch (replace the whole document),
(2) make **targeted edits** to a specific section (find → replace), and (3) keep the human in
the loop with a before/after diff + apply/cancel.

**Scope:** Built on the existing feature at
`nextjs/src/app/(dashboard)/resume-builder/` — no new routes or schema. The current
`api/ai/route.ts` already streams OpenRouter SSE with the flattened doc as context; the current
`AiPanel.tsx` already has the chat UX. This plan upgrades the request/response contract,
adds document-level application, and adds precise insertion.

**Deliverables (per user request):**
- AI can **replace the full document** (write a resume from scratch).
- AI can make **targeted edits** to existing sections.
- Safe, atomic apply (with undo support), diff preview, and accurate formatting.

---

## 1. Current state (verified)

| Area | File | Today |
|---|---|---|
| AI chat sidebar | `components/AiPanel.tsx` | Prompts + presets, POSTs to `/resume-builder/api/ai`, streams SSE, has a single **Insert** button |
| AI backend | `api/ai/route.ts` | Auth-checked, flattens `doc.json` to plain text (`summarizeDoc`, 8k cap), system prompt "plain text only", forwards model from `app_settings` |
| Apply | `components/ResumeEditorClient.tsx` `handleApplyAi` | Appends the AI output as new **paragraphs at the end of `doc.content`** |
| Editor | `components/ResumeEditor.tsx` | TipTap `useEditor`; `onDocChange` → parent `ResumeEditorClient`; autosave via `api/resumes/[id]` PATCH |
| Formatting | `lib/editor-schema.ts` | Tagged extensions: bold, italic, strike, heading 1–3, underline, lists, links, etc. Plugins serialize to `.docx` |

**Key problem:** The AI never touches existing content. Everything it generates appends to the
end of the document, and every node is inserted as a plain `paragraph`. So "improve the
experience section" creates a *new* experience block at the bottom instead of replacing the
original.

## 2. Design — a document-aware AI protocol

### 2.1 Request & response contract (backward-compatible)

Extend `AiRequest` and the SSE stream. The browser posts the current state and the AI returns a
**plan** that can be applied to the document without guessing.

```
POST /resume-builder/api/ai
{
  doc: ResumeDoc,          // full PM doc (existing)
  prompt: string,          // existing
  model?: string,          // existing
  mode: 'generate' | 'section' | 'full',   // NEW — see §2.2
  jobDescription?: string  // optional JD text for tailoring (nicety)
}
```

New response frame (in addition to existing `{delta}` / `{done}` / `{error}`):

```
data: { "type": "patch", "plan": { ... } }
```

`plan` is one of:

```ts
type AiEditPlan =
  // Targeted edit: anchor the old range, give the replacement content
  | { kind: 'patch-section'; anchor: string; replacement: PmNode[] }
  // Replace the entire doc
  | { kind: 'replace-doc'; doc: PmNode[] }
  // Free-form generate (falls back to the current append behavior)
  | { kind: 'append'; content: PmNode[] }
```

- `anchor` is a **verbatim excerpt** from the flattened doc text (e.g. `"Led a team of 8 engineers
  to ship 3 releases per year"`). The model is told to return text it *actually saw* in context.
- `content` / `doc` are **PM JSON nodes** matching the editor schema. The AI is told exactly
  which node/mark tags it may emit (subset: paragraphs, headings 1–3, bullet/ordered lists,
  bold/italic/underline, horizontal rules) and to avoid images/tables/URLs to keep the output
  valid.

### 2.2 Modes

| Mode | Prompt intent | Plan kind produced |
|---|---|---|
| `full` | "Write me a resume from scratch / replace the whole document" | `replace-doc` |
| `section` | "Improve the experience section / rewrite the summary" | `patch-section` with `anchor` |
| `generate` | "Give me a list of skills" (additive, existing behavior) | `append` |

`mode` is auto-inferred on the client from the prompt (keywords like "from scratch", "new
resume"/"replace", "rewrite the *" etc.) and can be overridden by the user's selection; it is
also re-checked server-side from the prompt as a safety net if omitted.

### 2.3 Streaming order

1. Model streams text deltas (`{delta}`) for immediate, familiar feedback.
2. When it finishes the final block, the route emits a single `{ type: "patch", plan }` last
   frame so the UI can render a **structured preview** and enable **Apply**.

For the `free` default model there is a correctness risk (see Risks) — the route retries once on
a malformed plan (no anchor found, invalid schema) with the error appended to the prompt, then
falls back to an `append` plan so the user is never stuck.

### 2.4 Where "apply" happens (new module: `lib/edit-apply.ts`)

Pure, testable application logic. Operates on a `ResumeDoc` `{ type:'doc', content }` and a
`AiPatchPlan`; returns the new `ResumeDoc`:

```
applyPatch(doc: ResumeDoc, plan: AiPatchPlan): { doc: ResumeDoc; applied: { type, anchor } }
```

- `replace-doc` → `{ type:'doc', content: plan.doc }` (validates every node against the schema
  allowlist; sanitize/drop asks from the model).
- `patch-section` → find the anchor range within the **flattened text** of a block node,
  normalize by trimming / collapsing whitespace, then `splice` the matched node's content out
  and insert `plan.content`. If a heading precedes the matched node, replace that heading + body
  together so a "rewrite the experience section" keeps its heading.
- `append` → existing behavior (`content.concat(plan.content)`), but now using
  `applyPatch` + `editor.commands.setContent` so it goes through the same transactional path.

All three run through the **same transactional path** (`applyPatch` → new doc), so the editor
change is a single transaction:
`editor.chain().focus().setContent(newDoc, { emitUpdate: false })` → notify `handleDocChange`
(which triggers autosave), then `revalidatePath`. Because the change goes through the editor's
own transaction, the existing history captures it — **Undo / Redo** already work.

### 2.5 The `AiPanel` UX (client)

New three-state flow replaces the single "Insert":

```
Stream → Preview (diff) → Apply
```

- **Preview**: when a `{patch}` frame arrives, render the plan as a mini "before → after"
  (before = anchor/truncated old text, after = new content as rendered PM nodes). For
  `replace-doc`, show a "This will replace your whole document" warning with word counts.
- **Apply buttons**: "Apply" (green, applies `applyPatch`) and "Undo" (after apply, uses editor
  history / `applyPatch` inverse).
- Manual cursor-aware insertion: the panel keeps a ref to `editor.selection` captured at send
  time; a small "insert at cursor (selected)" affordance becomes available when there's a
  non-empty selection, calling `editor.chain().focus().deleteSelection().insertContentAt(from,
  content)`. This also fixes a long-standing UX gap: currently AI "Insert" always appends.
- Region targeting affordance: chips to pick "target: whole resume / summary / experience /
  education / skills / custom", which set `mode` + anchor hint without needing exact text.

### 2.6 Editor plumbing changes (small, surgical)

- `ResumeEditor.tsx` — accept an optional `applyAiContent(plan)` prop or expose the editor
  instance via a ref/callback so `ResumeEditorClient` can run `applyPatch` + `setContent`
  inside the editor's own transaction. Keep `onDocChange` untouched.
- `ResumeEditorClient.tsx` — hold `editorRef`; `handleApplyAi` becomes `handleApplyPlan`
  (see §2.4); autosave continues to fire from `onDocChange` after AI apply.
- `AiPanel.tsx` — request `mode`/`jobId`; parse frames; render Stream → Preview → Apply;
  pass `onApplyPatch`.
- `lib/types.ts` — add `AiPatchPlan`, `AiRequest.mode`, `AiStreamChunk.patch`.

## 3. Files to touch (exact)

| File | Change |
|---|---|
| `nextjs/src/app/(dashboard)/resume-builder/lib/types.ts` | Add `AiPatchPlan`, `AiRequestMode`, extend `AiRequest` (`mode?`, `jobId?`), extend `AiStreamChunk` (`patch?: AiPatchPlan`) |
| `nextjs/src/app/(dashboard)/resume-builder/lib/schema-utils.ts` **(new)** | Node/mark allowlist, `isSafeNode`, sanitizer that drops unknown tags, `docToPlainText` with anchor-able offsets |
| `nextjs/src/app/(dashboard)/resume-builder/lib/apply-patch.ts` (new) | `applyPatch()` pure function (§2.4) |
| `nextjs/src/app/(dashboard)/resume-builder/api/ai/route.ts` | Read `mode`; build mode-specific system prompt (with node-type whitelist + anchor guidance); parse the final block into `new AiPatchPlan`; emit `{patch}` frame; retries on malformed plan |
| `nextjs/src/app/(dashboard)/resume-builder/components/ResumeEditor.tsx` | Expose editor instance / AI-apply callback (§2.6) |
| `nextjs/src/app/(dashboard)/resume-builder/components/ResumeEditorClient.tsx` | `handleApplyPatch` — runs `applyPatch`, applies via editor transaction, autosave through `onDocChange`, undo via editor history |
| `nextjs/src/app/(dashboard)/resume-builder/components/AiPanel.tsx` | mode inference + chips, preview/diff state, Apply/Undo, cursor-aware insert |
| `nextjs/src/app/(dashboard)/resume-builder/lib/openrouter.ts` | (no change needed — already streams deltas; route does plan assembly) |
| Tests (optional but recommended) | `applyPatch` unit tests (node replacement, anchor-miss fallback) |

## 4. Phased implementation (for the coding agent)

**Phase A — Protocol & pure apply (server-touch, no UX)**
1. `lib/types.ts`: add `AiPatchPlan` (`patch-section` / `replace-doc` / `append`), `AiRequest.mode`, `AiStreamChunk.patch`.
2. `lib/schema-utils.ts`: allowlist + `docToPlainText` with offsets + `isValidDoc`.
3. `lib/apply-patch.ts`: `applyPatch(doc, plan)` with anchor matching + sanitize; unit-test the three kinds (good anchor, missing anchor → fallback, invalid node → dropped).
4. `api/ai/route.ts`: mode routing; new system prompt (anchor + allowed-tags + JSON envelope); parse final delta into a `plan` (best-effort tolerant parser); always emit `{patch}` before `{done}`; retry-once + append fallback.

**Phase B — Apply in editor**
5. `ResumeEditor.tsx`: accept an optional `onApplyAi(plan)` / expose editor instance ref.
6. `ResumeEditorClient.tsx`: implement `handleApplyPatch` → `applyPatch` → `editor.commands.setContent(newDoc, { emitUpdate: false })` → `handleDocChange` (autosave) → focus; wire `undo` to editor history.
7. Verify: append still works; `replace-doc` swaps the whole doc; `patch-section` replaces only the anchored region; word-count + autosave stay consistent; **`Undo`** returns to the pre-AI doc.

**Phase C — AiPanel UX**
8. `AiPanel.tsx`: mode selection (chips / auto-detect), `jobId`, Preview card (before/after diff), Apply + Undo buttons, keep streaming deltas lively, disable Apply while streaming.
9. Polish: error state with retry; empty-doc "write from scratch" affordance; confirm-dialog on `replace-doc`.

**Phase D — Edge cases & polish**
10. Autosave conflicts (AI apply during pending save) — serialize apply/save.
11. Document size guard (already 8k flatten cap; add node-count cap for full-doc mode).
12. Accessibility: live-region announcements (`aria-live`) for streaming/preview/apply.

## 5. Non-goals (explicitly out of scope)
- No changes to the database schema (`resumes`, `app_settings`, RLS already owner-scoped).
- No new routes beyond possibly a tiny `retry` reuse of `/api/ai`; no chat history table.
- No PDF printing (out of scope; existing gap noted in STATUS). Editing only.
- **AI that appears to *edit* text in-place for arbitrary freeform prompts** without an anchor —
  anchors require the model to cite exact doc text; freeform "change X to Y" stays append /
  fails-safe. (Mitigation in Risks: small models retry + fallback, and users can re-target.)

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Free/small model (`poolside/laguna-s-2.1:free`) produces invalid PM JSON or a hallucinated anchor | Sanitizer (allowlist + drop invalid); server retry-once, then **append fallback** so a generation is never "lost"; UI still previews before applying. |
| Anchor not found (user edits since request; model misquotes) | Robust fuzzy matching (trim, collapse space, normalize unicode/quote chars); if still missing → `append` fallback + explicit toast. |
| Blocking full-doc generation on a free tier | Enforce a node-count/progress guard; stream deltas so users see progress; allow switching to a paid model in admin settings. |
| AI overwrites the user's work | Atomic apply in one transaction; editor history = undo; Preview before Apply; "replace-doc" gets explicit confirmation. |
| Model costs with free-tier keys / daily limits | Keep `mode` default to generate; only expensive modes (replace-doc) on user intent; fall back to `poolside/laguna-s-2.1:free`; admin can upgrade model & budget in `settings`. |
| Chat ↔ editor desync (AI apply while user types) | Apply captures & snapshots selection at send time; re-find anchor in the *current* doc on apply (applyPatch re-anchors); conflict → banner + re-preview. |

## 7. Definition of done
- [ ] "Write me a resume from scratch" → `replace-doc` → Preview → Apply swaps the whole
  document (word count, autosave, undo all consistent).
- [ ] "Improve the experience section" → `patch-section` replaces **only** the anchored
  experience block (heading preserved), not appends at the bottom.
- [ ] Existing "Insert/append" prompts still work through the same apply path (regression).
- [ ] Applying an AI edit is a single editor transaction; Undo/Redo works; autosave remains.
- [ ] Malformed AI output never breaks the doc — sanitize + retry + append fallback round-trip
  proven by unit tests on `applyPatch` and the route parser.
- [ ] UI: streaming deltas → Preview card (before/after) → Apply / Undo, with `replace-doc`
  confirmation and aria-live states.
- [ ] Everything remains deletable — new code is contained.
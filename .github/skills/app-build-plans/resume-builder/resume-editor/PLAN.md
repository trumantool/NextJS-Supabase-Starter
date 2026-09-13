# Resume Builder — Editor Feature Expansion Plan

**Goal:** Expand the Resume Builder's TipTap editor from its current minimal formatting set
(bold/italic/underline/strike, H1–H3, bullet/ordered lists) into a richer, resume-appropriate
editing experience: more text marks, block nodes (blockquote, code, horizontal rule, task
lists), **links**, **tables**, **images**, **text alignment**, **font size/color**, **undo/redo
history**, and a **word/character count**. Keep everything deletable and consistent with the
existing feature.

**Why now:** The editor (`ResumeEditor.tsx`) currently registers only `StarterKit` + `Underline`
+ `TextStyle` (see `lib/editor-schema.ts`). The toolbar (`ResumeToolbar.tsx`) exposes a handful
of buttons. Resumes benefit from links (portfolio/email), tables (skills matrix, education),
alignment (centered headers), and font styling — all of which are standard TipTap extensions
that map cleanly to the existing `.docx` exporter.

**Deletability:** All new/changed code stays inside `nextjs/src/app/app/resume-builder/`. The
only shared-file touches are new TipTap deps in `nextjs/package.json` (search `@tiptap`) and
the `Database` type in `nextjs/src/lib/types.ts` (only if we persist per-resume font/color
settings). Reverting = remove the deps + delete the new extension/toolbar code.

---

## 1. Architecture

```mermaid
flowchart TD
  Toolbar[ResumeToolbar.tsx<br/>new buttons: link, table, align, color, size, hr, quote, code, task, undo/redo] -->|commands| Editor[ResumeEditor.tsx]
  Editor -->|resumeExtensions| Schema[lib/editor-schema.ts<br/>expanded extension set]
  Editor -->|doc JSON| Export[api/export/route.ts]
  Export -->|doc + style| Docx[lib/docx-export.ts<br/>handle new nodes/marks]
  Editor -->|autosave doc_json| API[/api/resumes/[id]]
  Editor -->|word/char count| Status[StatusBar<br/>inline in editor]
```

**Key principle:** Extensions are the single source of truth for what the editor can do. The
toolbar buttons call the matching TipTap commands; the exporter must handle every node/mark the
editor can produce so the `.docx` stays faithful. Any node the exporter can't serialize yet is
either (a) added to the exporter in this plan, or (b) excluded from the extension set.

---

## 2. Extension set (target state of `lib/editor-schema.ts`)

Reference: https://tiptap.dev/docs/editor/extensions/nodes and
https://tiptap.dev/docs/editor/extensions/marks

### Already present
- `StarterKit` (document, paragraph, text, bold, italic, strike, heading 1–3, bulletList,
  orderedList, listItem, hardBreak, **history**)
- `Underline`
- `TextStyle`

### Add (marks)
| Extension | Package | Why for resumes | Exporter impact |
|---|---|---|---|
| `Link` | `@tiptap/extension-link` | Portfolio, email, LinkedIn URLs | Emit `<w:hyperlink>` + rels |
| `Highlight` | `@tiptap/extension-highlight` | Emphasize keywords (optional) | `<w:highlight w:val="yellow"/>` |
| `Subscript` / `Superscript` | `@tiptap/extension-subscript` / `-superscript` | Footnotes, dates, ordinals | `<w:vertAlign w:val="subscript/superscript"/>` |
| `Code` | `@tiptap/extension-code` | Inline tech terms | `<w:rFonts w:ascii="Consolas"/>` + `<w:shd/>` |
| `Color` | `@tiptap/extension-color` | Accent-colored name/headings | `<w:color w:val="RRGGBB"/>` |
| `FontSize` | `@tiptap/extension-font-size` | Scale headings/body | `<w:sz w:val="halfPoints"/>` |
| `TextAlign` | `@tiptap/extension-text-align` | Centered headers, right-aligned dates | `<w:jc w:val="center/right"/>` |

### Add (nodes)
| Extension | Package | Why for resumes | Exporter impact |
|---|---|---|---|
| `Blockquote` | `@tiptap/extension-blockquote` | Quote a reference/endorsement | `<w:pBdr>` left border |
| `CodeBlock` | `@tiptap/extension-code-block` | Code samples (dev resumes) | `<w:pPr>` + monospace runs |
| `HorizontalRule` | `@tiptap/extension-horizontal-rule` | Section dividers | `<w:pBdr>` bottom border |
| `TaskList` + `TaskItem` | `@tiptap/extension-task-list` / `-task-item` | Checklist-style skills | `<w:numPr>` + checkbox char |
| `Table` (+ `TableRow`, `TableCell`, `TableHeader`) | `@tiptap/extension-table` (+ row/cell/header) | Skills matrix, education grid | `<w:tbl>` with borders |
| `Image` | `@tiptap/extension-image` | Headshot, logo (optional) | `<w:drawing>` + media part |

### Explicitly NOT added (keep scope tight)
- `Mention`, `Emoji`, `Youtube`, `Twitch`, `Audio`, `Details`, `Mathematics` — not resume-relevant.
- `Placeholder` — nice-to-have; defer to a follow-up (see §7).

### Configuration notes
- `Link`: `openOnClick: false`, `autolink: true`, `linkOnPaste: true`, `HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }`.
- `TextAlign`: `types: ['heading', 'paragraph']`.
- `Table`: `resizable: true`, `allowTableNodeSelection: true`.
- `TaskItem`: `nested: true`.
- `Highlight`: `multicolor: false` (keep simple).
- `FontSize`: configure allowed sizes (e.g. 10–24pt) to keep the `.docx` mapping bounded.

---

## 3. Toolbar additions (`ResumeToolbar.tsx`)

Add grouped buttons (lucide icons), following the existing `ToolButton` pattern:

| Group | Buttons | Command |
|---|---|---|
| **History** | Undo, Redo | `editor.chain().focus().undo().run()` / `.redo()` |
| **Align** | Left, Center, Right | `setTextAlign('left'/'center'/'right')` |
| **Blocks** | Blockquote, Code block, Horizontal rule | `toggleBlockquote()`, `toggleCodeBlock()`, `setHorizontalRule()` |
| **Lists** | Task list | `toggleTaskList()` |
| **Link** | Add/Edit link, Remove link | `setLink({ href })` (prompt for URL), `unsetLink()` |
| **Table** | Insert table, Add row/col, Delete row/col, Delete table | `insertTable({ rows, cols, withHeaderRow })`, `addRowAfter()`, `addColumnAfter()`, `deleteRow()`, `deleteColumn()`, `deleteTable()` |
| **Style** | Text color, Highlight, Font size, Sub/Superscript | `setColor()`, `toggleHighlight()`, `setFontSize()`, `toggleSubscript()`, `toggleSuperscript()` |
| **Image** | Insert image | `setImage({ src })` (prompt for URL) |

- Disable buttons when the command isn't applicable (e.g. table buttons only when a table is
  active; undo/redo when `editor.can().undo()` is false).
- Keep the existing AI + Export buttons at the right edge.

---

## 4. Status bar (word/character count)

Add a slim status bar under the editor (or in the toolbar's right edge) showing live
**word count** and **character count**, computed from the editor's text:

```ts
const text = editor.getText()
const words = text.trim() ? text.trim().split(/\s+/).length : 0
const chars = text.length
```

- Update on `onUpdate` (already wired in `ResumeEditor.tsx`).
- Useful for the "one page" resume constraint.

---

## 5. `.docx` exporter updates (`lib/docx-export.ts`)

The exporter must serialize every new node/mark. Extend the existing self-contained OOXML
builder:

| Feature | OOXML |
|---|---|
| **Link** | `<w:hyperlink r:id="rIdN">` + add a relationship in `word/_rels/document.xml.rels` + `<w:externalRelationship>` in `[Content_Types].xml` |
| **Highlight** | `<w:highlight w:val="yellow"/>` in `rPr` |
| **Sub/Superscript** | `<w:vertAlign w:val="subscript"/"superscript"/>` in `rPr` |
| **Code (inline)** | `<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>` + `<w:shd w:fill="F2F2F2"/>` |
| **Color** | `<w:color w:val="RRGGBB"/>` in `rPr` |
| **FontSize** | `<w:sz w:val="halfPoints"/>` in `rPr` |
| **TextAlign** | `<w:jc w:val="center"/"right"/"left"/>` in `pPr` |
| **Blockquote** | `<w:pBdr><w:left w:val="single" w:sz="12" w:color="999999"/></w:pBdr>` + indent |
| **CodeBlock** | `<w:pPr>` with monospace `rPr` + `<w:shd>` |
| **HorizontalRule** | `<w:pBdr><w:bottom w:val="single" w:sz="6"/></w:pBdr>` on an empty paragraph |
| **TaskList/TaskItem** | `<w:numPr>` + a checkbox glyph (`☐`/`☑`) run |
| **Table** | `<w:tbl>` with `<w:tblBorders>`, `<w:tr>`, `<w:tc>`; header row uses `<w:tcPr><w:shd/></w:tcPr>` |
| **Image** | `<w:drawing>` + embed the image as a media part in the ZIP (needs the image bytes; see risk) |

- Keep the existing `buildZip` store-only writer; add media parts for images.
- Validate each new feature by unzipping the output and opening in Word (same method as the
  original plan's Phase 2).

---

## 6. Phased implementation (for the coding agent)

**Phase 0 — Dependencies & types**
1. Add TipTap deps to `nextjs/package.json`: `@tiptap/extension-link`, `-highlight`,
   `-subscript`, `-superscript`, `-code`, `-color`, `-font-size`, `-text-align`,
   `-blockquote`, `-code-block`, `-horizontal-rule`, `-task-list`, `-task-item`, `-table`,
   `-table-row`, `-table-cell`, `-table-header`, `-image`. Run `npm install`.
2. (Optional) If persisting per-resume font/color defaults, add a `style` column to the
   `resumes` row shape in `nextjs/src/lib/types.ts` (see the resume-templates plan for the
   existing `style jsonb` column — reuse it if already applied).

**Phase 1 — Extension set**
3. Rewrite `lib/editor-schema.ts` to register the full extension set from §2 with the
   documented configuration. Keep `StarterKit` for history + core nodes.

**Phase 2 — Toolbar & status bar**
4. Extend `ResumeToolbar.tsx` with the grouped buttons from §3, wiring each to the matching
   command and adding disabled states.
5. Add the word/character count status bar (§4) in `ResumeEditor.tsx`.

**Phase 3 — Exporter**
6. Extend `lib/docx-export.ts` to serialize all new nodes/marks (§5). Add link rels, table
   support, and (if images are enabled) media parts.
7. Update `api/export/route.ts` if it needs to pass the resume `style`/font defaults through.

**Phase 4 — Polish & validation**
8. Add empty/loading states for the new toolbar groups; verify undo/redo works across all new
   commands.
9. Validate `.docx` output for each new feature (unzip + open in Word).
10. Confirm RLS still covers any new persisted columns; run `npm run build` and `npm run lint`.

---

## 7. Files touched

| File | Change |
|---|---|
| `nextjs/package.json` | Add ~18 `@tiptap/extension-*` deps |
| `nextjs/src/app/app/resume-builder/lib/editor-schema.ts` | Register full extension set |
| `nextjs/src/app/app/resume-builder/components/ResumeToolbar.tsx` | New grouped buttons + disabled states |
| `nextjs/src/app/app/resume-builder/components/ResumeEditor.tsx` | Status bar; pass editor to toolbar |
| `nextjs/src/app/app/resume-builder/lib/docx-export.ts` | Serialize new nodes/marks; link rels; tables; images |
| `nextjs/src/app/app/resume-builder/api/export/route.ts` | Pass style/font defaults (if any) |
| `nextjs/src/lib/types.ts` | (Optional) `style` column on `resumes` row shape |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Exporter can't handle a new node → broken `.docx` | Only add extensions the exporter serializes; add exporter support in the same phase; validate by unzip + Word open. |
| Images need binary media parts in the ZIP | Extend `buildZip` to accept `Uint8Array` values (not just strings); fetch image bytes server-side in the export route. If too complex, ship images as a follow-up. |
| Table editing UX in TipTap is fiddly | Use the official `@tiptap/extension-table` with `resizable: true`; keep toolbar actions minimal (insert, add/delete row/col, delete table). |
| Font size/color values drift from `.docx` | Bound allowed sizes (10–24pt) and map to half-points; map color hex directly to `w:color`. |
| Bundle size grows with many extensions | TipTap extensions are tree-shakeable; only import the ones used. Lazy-load the editor if needed. |
| `style` column migration conflicts with resume-templates plan | Reuse the existing `style jsonb` column from `20260812_resume_builder.sql` if the templates plan already added it; otherwise add it here. |

---

## 9. Definition of done

- The editor supports: undo/redo, text alignment, links, highlight, sub/superscript, inline
  code, text color, font size, blockquote, code block, horizontal rule, task lists, tables,
  and (optionally) images.
- The toolbar exposes a button for each feature with correct active/disabled states.
- A live word/character count is visible in the editor.
- The `.docx` export faithfully renders every new node/mark and opens cleanly in Word.
- Everything is deletable by removing the new TipTap deps + the changed files under
  `nextjs/src/app/app/resume-builder/`.
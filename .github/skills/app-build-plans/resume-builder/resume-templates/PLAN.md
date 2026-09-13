# Resume Builder — Template Improvements Plan

**Goal:** Turn the Resume Builder's templates from *content-only seeds* into *real, visually
distinct templates* — each with its own layout, typography, accent color, and section styling —
that render consistently in the TipTap editor, the template picker preview, and the `.docx`
export. Model the new templates on the reference resume the user shared (a Google Doc with a
distinct visual layout).

**Why now:** Today the three templates (`classic`, `modern`, `compact`) differ **only in seed
content**. The editor (`ResumeEditor.tsx`) applies the same `prose` CSS to every template, and
the exporter (`docx-export.ts`) emits one hardcoded `styles.xml` (Calibri, no color, single
column). Picking "Modern" produces the exact same look as "Classic." This plan gives templates a
real visual identity.

**Deletability:** All new/changed code stays inside `nextjs/src/app/app/resume-builder/`. The
only shared-file touch is the `Database` type in `nextjs/src/lib/types.ts` (add a `style` column
to the `resumes` row shape) and the migration
`supabase/migrations/20260812_resume_builder.sql` (add a `style` column). Reverting = drop the
column + delete the new template entries.

---

## 1. Architecture

```mermaid
flowchart TD
  Picker[TemplatePicker.tsx] -->|select template| T[Template<br/>id + doc + style]
  T -->|style| Editor[ResumeEditor.tsx<br/>applies CSS vars + layout]
  T -->|style| Preview[TemplatePicker preview<br/>mini styled mock]
  Editor -->|doc + template id| Export[api/export/route.ts]
  Export -->|style| Docx[docx-export.ts<br/>template-aware styles.xml + layout]
  Editor -->|autosave doc + template| API[/api/resumes/[id]]
  API --> PG[(Supabase<br/>resumes.style jsonb)]
```

**Key principle:** A template is now `{ id, name, description, doc, style }`. The `style` object
is the single source of truth for how the template looks. The editor, picker preview, and docx
exporter all read the same `style` so the on-screen preview matches the exported file.

---

## 2. Data model

### Template `style` object (new, in `lib/templates.ts`)

```ts
export interface ResumeTemplateStyle {
  /** Base font family for body text. */
  fontFamily: string
  /** Accent color used for section headers / name / rules. */
  accentColor: string
  /** How the name + contact block is laid out. */
  headerLayout: 'centered' | 'left' | 'two-column'
  /** Visual treatment for section headings. */
  sectionStyle: 'underline' | 'rule' | 'accent-bar' | 'minimal'
  /** Show a divider between sections. */
  showSectionDividers: boolean
  /** Render skills/contact in a sidebar column (two-column layout). */
  twoColumn?: boolean
  /** Sidebar background color when twoColumn is true. */
  sidebarColor?: string
  /** Heading font family (falls back to fontFamily). */
  headingFont?: string
  /** Body font size in pt. */
  fontSize?: number
}

export interface ResumeTemplate {
  id: string
  name: string
  description: string
  doc: ResumeDoc
  style: ResumeTemplateStyle
}
```

### Database change (migration)

Add a nullable `style jsonb` column to `public.resumes` so a user's chosen template style
persists and can be switched later:

```sql
alter table public.resumes
  add column if not exists style jsonb;
```

No RLS change needed — the existing owner-scoped policies already cover the new column.

---

## 3. Template archetypes (replace the current 3)

Replace the current near-identical seeds with four visually distinct archetypes. Each keeps
realistic seed content but gains a distinct `style`.

| id | Name | Layout | Typography | Accent | Notes |
|---|---|---|---|---|---|
| `classic` | Classic | centered header, single column | serif (Georgia) | dark navy | section headers with bottom rule |
| `modern` | Modern | **two-column** (sidebar + main) | sans-serif (Inter) | blue | sidebar holds contact + skills; matches the reference doc's structure |
| `minimal` | Minimal | left header, single column | sans-serif (Helvetica) | none (black) | ATS-friendly, no color, no dividers |
| `creative` | Creative | left header, single column | sans-serif + accent bar | violet | accent-bar section headers, larger name |

> The `modern` template is the priority — it introduces the two-column layout that most closely
> mirrors the reference resume the user shared.

---

## 4. Phased implementation (for the coding agent)

**Phase 0 — Data model & types**
1. Add `ResumeTemplateStyle` + extend `ResumeTemplate` in `lib/templates.ts`.
2. Add `style?: Json` to the `resumes` row/insert/update shapes in `lib/types.ts` and
   `nextjs/src/lib/types.ts` (`Database` type).
3. Add migration `supabase/migrations/20260812_resume_builder.sql` change: `alter table
   public.resumes add column if not exists style jsonb;` and apply locally/remotely.

**Phase 1 — Template definitions**
4. Rewrite the 4 templates in `lib/templates.ts` with distinct `style` objects and seed docs.
   Ensure the `modern` template's doc marks which nodes belong in the sidebar (e.g. a
   `sidebar`-flagged heading or a dedicated "Contact"/"Skills" section) so the renderer can
   split columns.

**Phase 2 — Editor rendering**
5. `ResumeEditor.tsx`: read the template `style` (passed as a prop) and apply it to the editor
   container via CSS variables (`--accent`, `--font-family`, `--heading-font`) and Tailwind
   classes. For `twoColumn`, render the doc in a two-column flex layout (sidebar + main).
6. `ResumeEditorClient.tsx`: load the resume's `style` (from the `resumes` row) and pass it to
   `ResumeEditor`; persist `style` on autosave.

**Phase 3 — Template picker preview**
7. `TemplatePicker.tsx`: replace the text-only preview with a **mini styled mock** that renders
   the template's name, a couple of section headers, and a skills block using the template's
   `style` (font, accent color, two-column layout). This lets users see the real look before
   choosing.

**Phase 4 — Template-aware docx export**
8. `docx-export.ts`: accept a `style` argument and generate template-specific `styles.xml`
   (fonts, heading sizes/colors, spacing). Map `sectionStyle` to `w:pBdr` (bottom border) or
   `w:shd` (accent bar). For `twoColumn`, emit a `w:tbl` with a shaded sidebar cell.
9. `api/export/route.ts`: read the resume's `style` and pass it to `buildDocx`.

**Phase 5 — Template switching**
10. Add a "Change template" control in the editor that swaps the `style` (and optionally remaps
    content) without losing the user's text. Persist the new `style` via the existing PATCH
    route.

**Phase 6 — Polish**
11. Empty/loading states for the new previews; verify RLS still covers the `style` column;
    confirm `.docx` output opens cleanly in Word for each template.

---

## 5. Files touched

| File | Change |
|---|---|
| `nextjs/src/app/app/resume-builder/lib/templates.ts` | Add `ResumeTemplateStyle`; rewrite 4 templates with distinct styles |
| `nextjs/src/app/app/resume-builder/lib/types.ts` | Add `style` to `ResumeMeta`/`ResumeInsert`/`ResumeUpdate` |
| `nextjs/src/lib/types.ts` | Add `style` to the `resumes` row shape in `Database` |
| `nextjs/src/app/app/resume-builder/components/ResumeEditor.tsx` | Apply template `style` via CSS vars + two-column layout |
| `nextjs/src/app/app/resume-builder/components/ResumeEditorClient.tsx` | Load/persist `style`; pass to editor |
| `nextjs/src/app/app/resume-builder/components/TemplatePicker.tsx` | Styled mini previews |
| `nextjs/src/app/app/resume-builder/lib/docx-export.ts` | Template-aware `styles.xml` + two-column table |
| `nextjs/src/app/app/resume-builder/api/export/route.ts` | Pass `style` to `buildDocx` |
| `nextjs/src/app/app/resume-builder/[id]/page.tsx` | Load `style` from resume row |
| `supabase/migrations/20260812_resume_builder.sql` | Add `style jsonb` column |

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Two-column layout in TipTap is awkward (single doc flow) | Model sidebar content as a flagged section in the doc; split at render/export time rather than using a real table node in the editor. |
| `.docx` two-column fidelity | Use a `w:tbl` with a shaded sidebar cell; validate output by unzipping + opening in Word. |
| Template switch could lose content | Only swap `style` by default; content remap is opt-in and non-destructive (append, never delete). |
| CSS vars not applied to TipTap content | Apply vars on the editor container and use `prose` overrides scoped to that container. |
| Migration on existing rows | Column is nullable; existing resumes fall back to `classic` style when `style` is null. |

---

## 7. Definition of done

- Each of the 4 templates renders with a **distinct visual identity** (layout, font, accent,
  section styling) in the editor.
- The template picker shows **styled mini previews** that match the editor look.
- The `.docx` export honors the template `style` (fonts, colors, two-column layout) and opens
  cleanly in Word.
- A user can **switch templates** after creation without losing their content.
- Everything is deletable by removing `nextjs/src/app/app/resume-builder/` + reverting the
  `style` column migration.
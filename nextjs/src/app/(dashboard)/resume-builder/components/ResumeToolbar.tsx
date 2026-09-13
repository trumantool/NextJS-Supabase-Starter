'use client'

// Resume Builder — formatting toolbar + AI + export actions.
import { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Sparkles,
  Download,
  Loader2,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Code as CodeIcon,
  Minus,
  ListTodo,
  Link,
  Link2Off,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
  Palette,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Image as ImageIcon,
} from 'lucide-react'
import { ALLOWED_FONT_SIZES } from '../lib/font-size-extension'

interface Props {
  editor: Editor | null
  onExport: () => void
  onOpenAi: () => void
  exporting?: boolean
}

function ToolButton({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-md transition-colors disabled:opacity-40 ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />
}

function ExportButton({
  onClick,
  exporting,
}: {
  onClick: () => void
  exporting?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={exporting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export .docx
    </button>
  )
}

export function ResumeToolbar({ editor, onExport, onOpenAi, exporting }: Props) {
  // Snapshots the editor text selection so the native color picker (which
  // steals focus) does not clear it before setColor() runs.
  const colorSelectionRef = useRef<{ from: number; to: number } | null>(null)

  if (!editor) return null
  const ed = editor

  const promptForUrl = (title: string): string | null =>
    window.prompt(title)?.trim() || null

  function addLink() {
    const url = promptForUrl('Enter link URL (e.g. https://linkedin.com/in/...)')
    if (!url) return
    ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function insertImage() {
    const url = promptForUrl('Enter image URL')
    if (!url) return
    ed.chain().focus().setImage({ src: url }).run()
  }

  function insertTable() {
    const colsRaw = window.prompt('Number of columns', '2')
    const rowsRaw = window.prompt('Number of rows', '2')
    const cols = colsRaw ? parseInt(colsRaw, 10) : NaN
    const rows = rowsRaw ? parseInt(rowsRaw, 10) : NaN
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return
    const safeCols = Math.min(Math.max(cols, 1), 10)
    const safeRows = Math.min(Math.max(rows, 1), 20)
    ed
      .chain()
      .focus()
      .insertTable({ rows: safeRows, cols: safeCols, withHeaderRow: true })
      .run()
  }

  const inTable = ed.isActive('table')
  const currentFontSize = parseInt(ed.getAttributes('textStyle').fontSize, 10)
  const currentColor = (ed.getAttributes('textStyle').color as string) || '#000000'

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-2 flex-wrap">
      {/* History */}
      <ToolButton
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Highlight"
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Palette className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Subscript"
        active={editor.isActive('subscript')}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      >
        <SubscriptIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Superscript"
        active={editor.isActive('superscript')}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <SuperscriptIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolButton>

      {/* Font size */}
      <select
        title="Font size"
        value={Number.isFinite(currentFontSize) ? String(currentFontSize) : ''}
        onChange={(e) => {
          const v = e.target.value
          editor
            .chain()
            .focus()
            .setFontSize(v ? Number(v) : null)
            .run()
        }}
        className="h-8 text-sm border border-gray-200 rounded-md px-1 text-gray-600 bg-white"
      >
        <option value="">Size</option>
        {ALLOWED_FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}pt
          </option>
        ))}
      </select>

      {/* Text color */}
      <label
        title="Text color"
        className="w-7 h-7 rounded-md border border-gray-200 cursor-pointer flex items-center justify-center"
        style={{ background: currentColor }}
      >
        <input
          type="color"
          value={currentColor}
          onMouseDown={(e) => {
            // Snapshot the current text selection BEFORE the native picker
            // steals focus from the editor. Without this, opening the picker
            // clears the selection and setColor() below applies to nothing.
            if (!e.currentTarget.disabled) {
              colorSelectionRef.current = {
                from: ed.state.selection.from,
                to: ed.state.selection.to,
              }
            }
          }}
          onChange={(e) => {
            ed
              .chain()
              .focus()
              .command(({ tr }) => {
                const sel = colorSelectionRef.current
                if (sel && sel.from !== sel.to) {
                  tr.setSelection(
                    TextSelection.create(tr.doc, sel.from, sel.to)
                  )
                }
                return true
              })
              .setColor(e.target.value)
              .run()
            // Clear the snapshot once applied.
            colorSelectionRef.current = null
          }}
          className="w-0 h-0 opacity-0 absolute"
        />
      </label>

      <Divider />

      <ToolButton
        title="Align left"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Align center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Align right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Ordered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Task list"
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Blockquote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        title="Add link"
        active={editor.isActive('link')}
        onClick={addLink}
      >
        <Link className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Remove link"
        disabled={!editor.isActive('link')}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Link2Off className="h-4 w-4" />
      </ToolButton>

      <Divider />

      {/* Table group */}
      <ToolButton title="Insert table" onClick={insertTable}>
        <TableIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Add row"
        disabled={!inTable}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <Rows3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Add column"
        disabled={!inTable}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <Columns3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Delete row"
        disabled={!inTable}
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        <Rows3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Delete column"
        disabled={!inTable}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        <Columns3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Delete table"
        disabled={!inTable}
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 className="h-4 w-4" />
      </ToolButton>

      <ToolButton title="Insert image" onClick={insertImage}>
        <ImageIcon className="h-4 w-4" />
      </ToolButton>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenAi}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>
      <ExportButton onClick={onExport} exporting={exporting} />
    </div>
  )
}
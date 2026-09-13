// Resume Builder — TipTap/ProseMirror editor schema.
// Expanded extension set suitable for resume documents. The toolbar buttons in
// ResumeToolbar.tsx call the matching commands; the .docx exporter
// (docx-export.ts) serializes every node/mark listed here.

import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Code from '@tiptap/extension-code'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Blockquote from '@tiptap/extension-blockquote'
import CodeBlock from '@tiptap/extension-code-block'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import { FontSize } from './font-size-extension'

/**
 * The extension set used by the resume editor.
 * StarterKit supplies: document, paragraph, text, bold, italic, strike,
 * heading, bulletList, orderedList, listItem, hardBreak, history, etc.
 */
export const resumeExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Underline,
  TextStyle,
  // Marks
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      rel: 'noopener noreferrer nofollow',
      target: '_blank',
    },
  }),
  Highlight.configure({
    multicolor: false,
  }),
  Subscript,
  Superscript,
  Code,
  Color,
  FontSize,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  // Nodes
  Blockquote,
  CodeBlock,
  HorizontalRule,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({
    resizable: true,
    allowTableNodeSelection: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Image,
]
// Documents — seed TipTap templates as ProseMirror JSON.
import type { TipTapDoc } from './types'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  doc: TipTapDoc
}

const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})

const p = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

const bullet = (text: string) => ({
  type: 'listItem',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
})

const bulletList = (items: string[]) => ({
  type: 'bulletList',
  content: items.map(bullet),
})

export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'An empty page to start from scratch.',
    doc: {
      type: 'doc',
      content: [h(1, 'Untitled'), p('')],
    },
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'A simple outline for meeting or personal notes.',
    doc: {
      type: 'doc',
      content: [
        h(1, 'Notes'),
        p('Date · attendees or context'),
        h(2, 'Agenda'),
        bulletList(['Topic one', 'Topic two', 'Topic three']),
        h(2, 'Notes'),
        p('Capture discussion, decisions, and open questions.'),
        h(2, 'Next steps'),
        bulletList(['Owner — action — due date']),
      ],
    },
  },
  {
    id: 'brief',
    name: 'Brief',
    description: 'A short project or writing brief.',
    doc: {
      type: 'doc',
      content: [
        h(1, 'Brief'),
        h(2, 'Goal'),
        p('What this document is for and who it is for.'),
        h(2, 'Background'),
        p('Context the reader needs before the details.'),
        h(2, 'Outline'),
        bulletList(['Section one', 'Section two', 'Section three']),
        h(2, 'Open questions'),
        bulletList(['What still needs an answer?']),
      ],
    },
  },
]

export function getTemplate(id: string): DocumentTemplate {
  return documentTemplates.find((t) => t.id === id) ?? documentTemplates[0]
}

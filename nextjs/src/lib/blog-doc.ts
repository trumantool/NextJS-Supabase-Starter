import type { PmNode, TipTapDoc } from '@/app/(dashboard)/documents/lib/types'

export type BlogDoc = TipTapDoc

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export function isTipTapDoc(value: unknown): value is BlogDoc {
  return isRecord(value) && value.type === 'doc' && Array.isArray(value.content)
}

export function docFromBody(body: string | null | undefined): BlogDoc {
  const text = (body ?? '').trim()
  if (!text) return { type: 'doc', content: [{ type: 'paragraph' }] }
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function inlineToMarkdown(nodes: PmNode[] | undefined): string {
  if (!nodes) return ''
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\n'
      if (node.type !== 'text') return node.content ? inlineToMarkdown(node.content) : node.text ?? ''
      let text = node.text ?? ''
      const marks = node.marks ?? []
      if (marks.some((mark) => mark.type === 'code')) text = `\`${text}\``
      if (marks.some((mark) => mark.type === 'bold')) text = `**${text}**`
      if (marks.some((mark) => mark.type === 'italic')) text = `*${text}*`
      const link = marks.find((mark) => mark.type === 'link')
      if (typeof link?.attrs?.href === 'string' && link.attrs.href) {
        text = `[${text}](${link.attrs.href})`
      }
      return text
    })
    .join('')
}

function blockToMarkdown(node: PmNode): string {
  switch (node.type) {
    case 'paragraph':
      return inlineToMarkdown(node.content)
    case 'heading': {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
      const hashes = '#'.repeat(Math.min(Math.max(level, 1), 6))
      return `${hashes} ${inlineToMarkdown(node.content)}`
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => `- ${blockToMarkdown(item).replace(/\n/g, '\n  ')}`)
        .join('\n')
    case 'orderedList':
      return (node.content ?? []).map((item, index) => `${index + 1}. ${blockToMarkdown(item)}`).join('\n')
    case 'listItem':
      return (node.content ?? []).map((child) => blockToMarkdown(child)).join('\n')
    case 'blockquote':
      return (node.content ?? [])
        .map((child) =>
          blockToMarkdown(child)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')
        )
        .join('\n')
    case 'codeBlock': {
      const code = (node.content ?? []).map((child) => child.text ?? inlineToMarkdown(child.content)).join('')
      return `\`\`\`\n${code}\n\`\`\``
    }
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
      return src ? `![${alt}](${src})` : ''
    }
    case 'horizontalRule':
      return '---'
    default: {
      if (node.content) {
        return node.content
          .map((child) => (child.type === 'text' ? inlineToMarkdown([child]) : blockToMarkdown(child)))
          .filter((part) => part.length > 0)
          .join('\n')
      }
      return node.text ?? ''
    }
  }
}

export function docToMarkdown(doc: unknown): string {
  if (!isTipTapDoc(doc)) return ''
  return doc.content
    .map((node) => blockToMarkdown(node))
    .filter((part) => part.length > 0)
    .join('\n\n')
}

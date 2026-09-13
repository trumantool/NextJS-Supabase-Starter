import type { Json } from '@/lib/types'

export type ChatAttachment = {
  name: string
  url: string
  contentType: string
  size: number
  storagePath?: string
}

export type ChatTextPart = { type: 'text'; text: string }
export type ChatAttachmentPart = { type: 'attachment'; attachment: ChatAttachment }
export type ChatMessagePart = ChatTextPart | ChatAttachmentPart

export type ChatMessageContent = {
  parts: ChatMessagePart[]
}

export type ChatUiMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: ChatMessageContent
  created_at?: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseAttachment(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === 'string' ? value.name : ''
  const url = typeof value.url === 'string' ? value.url : ''
  const contentType = typeof value.contentType === 'string' ? value.contentType : 'application/octet-stream'
  const size = typeof value.size === 'number' && Number.isFinite(value.size) ? value.size : 0
  if (!name || !url) return null
  const storagePath = typeof value.storagePath === 'string' ? value.storagePath : undefined
  return { name, url, contentType, size, storagePath }
}

export function parseMessageParts(value: unknown): ChatMessagePart[] {
  if (!isRecord(value) || !Array.isArray(value.parts)) return []
  const parts: ChatMessagePart[] = []
  for (const part of value.parts) {
    if (!isRecord(part) || typeof part.type !== 'string') continue
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({ type: 'text', text: part.text })
      continue
    }
    if (part.type === 'attachment') {
      const attachment = parseAttachment(part.attachment)
      if (attachment) parts.push({ type: 'attachment', attachment })
    }
  }
  return parts
}

export function messageContentFromUnknown(value: unknown): ChatMessageContent {
  const parts = parseMessageParts(value)
  if (parts.length > 0) return { parts }
  if (typeof value === 'string' && value.trim()) {
    return { parts: [{ type: 'text', text: value }] }
  }
  return { parts: [] }
}

export function textFromContent(content: ChatMessageContent): string {
  return content.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim()
}

export function attachmentsFromContent(content: ChatMessageContent): ChatAttachment[] {
  return content.parts.flatMap((part) =>
    part.type === 'attachment' ? [part.attachment] : []
  )
}

export function buildUserContent(text: string, attachments: ChatAttachment[]): ChatMessageContent {
  const parts: ChatMessagePart[] = []
  const trimmed = text.trim()
  if (trimmed) parts.push({ type: 'text', text: trimmed })
  for (const attachment of attachments) {
    parts.push({ type: 'attachment', attachment })
  }
  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' })
  }
  return { parts }
}

export function buildAssistantContent(text: string): ChatMessageContent {
  return { parts: [{ type: 'text', text }] }
}

export function contentToJson(content: ChatMessageContent): Json {
  return content as unknown as Json
}

export function flattenContentForModel(content: ChatMessageContent): string {
  const text = textFromContent(content)
  const attachments = attachmentsFromContent(content)
  if (attachments.length === 0) return text
  const listed = attachments
    .map((file) => `- ${file.name} (${file.contentType}${file.url ? `, ${file.url}` : ''})`)
    .join('\n')
  return [text, `Attached files:\n${listed}`].filter(Boolean).join('\n\n')
}

export function titleFromFirstMessage(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return 'New chat'
  return compact.length > 60 ? `${compact.slice(0, 57)}…` : compact
}

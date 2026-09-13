import { createSPAClient } from '@/lib/supabase/client'
import type { ChatAttachment } from '@/lib/chat-messages'

export const CHAT_FILES_BUCKET = 'files'
export const CHAT_ATTACHMENT_PREFIX = 'chat-attachments'
export const CHAT_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024

export const CHAT_ATTACHMENT_ACCEPT =
  'image/*,text/csv,application/pdf,text/plain,application/json'

const ALLOWED_CHAT_ATTACHMENT_TYPES = new Set([
  'text/csv',
  'application/pdf',
  'text/plain',
  'application/json',
])

export function sanitizeChatFilename(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || 'file'
  return base.replace(/[^0-9a-zA-Z!\-_.*'()]/g, '_')
}

/** `{userId}/chat-attachments/{chatId}/{timestamp}-{filename}` — matches `files` RLS. */
export function chatAttachmentObjectPath(
  userId: string,
  chatId: string,
  filename: string
): string {
  const safeName = sanitizeChatFilename(filename)
  return `${userId}/${CHAT_ATTACHMENT_PREFIX}/${chatId}/${Date.now()}-${safeName}`
}

export function isAllowedChatAttachment(file: File): string | null {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return `“${file.name}” is larger than 10 MB.`
  }
  if (file.type.startsWith('image/')) return null
  if (ALLOWED_CHAT_ATTACHMENT_TYPES.has(file.type)) return null
  return `“${file.name}” is not an allowed attachment type.`
}

export async function uploadChatAttachment(opts: {
  userId: string
  chatId: string
  file: File
}): Promise<ChatAttachment> {
  const typeError = isAllowedChatAttachment(opts.file)
  if (typeError) throw new Error(typeError)

  const path = chatAttachmentObjectPath(opts.userId, opts.chatId, opts.file.name)
  const supabase = createSPAClient()
  const { error: uploadError } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .upload(path, opts.file, { upsert: true, cacheControl: '3600' })

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload attachment')
  }

  const { data, error: signError } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .createSignedUrl(path, CHAT_SIGNED_URL_TTL_SEC)

  if (signError || !data?.signedUrl) {
    throw new Error(signError?.message || 'Failed to sign attachment URL')
  }

  return {
    name: opts.file.name,
    url: data.signedUrl,
    contentType: opts.file.type || 'application/octet-stream',
    size: opts.file.size,
    storagePath: path,
  }
}

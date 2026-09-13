import type { Database } from '@/lib/types'
import type { TagRef } from '@/lib/chat-tags'

export type ChatRow = Database['public']['Tables']['chats']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']

export type ChatThread = ChatRow & { tags: TagRef[] }

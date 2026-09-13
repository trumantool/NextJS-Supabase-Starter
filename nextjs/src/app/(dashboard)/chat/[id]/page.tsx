import { notFound, redirect } from 'next/navigation'
import ChatView from '@/components/chat/ChatView'
import type { ChatThread } from '@/lib/chat-types'
import { messageContentFromUnknown, type ChatUiMessage } from '@/lib/chat-messages'
import { fetchTagsByChatIds } from '@/lib/chat-tags'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Chat',
}

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !chat) notFound()

  const { data: rows } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true })

  const tagsByChat = await fetchTagsByChatIds(supabase, [chat.id])
  const initialChat: ChatThread = {
    ...chat,
    tags: tagsByChat.get(chat.id) ?? [],
  }

  const initialMessages: ChatUiMessage[] = (rows || [])
    .filter((row) => row.role === 'user' || row.role === 'assistant' || row.role === 'system')
    .map((row) => ({
      id: row.id,
      role: row.role as ChatUiMessage['role'],
      content: messageContentFromUnknown(row.content),
      created_at: row.created_at,
    }))

  return <ChatView initialChat={initialChat} initialMessages={initialMessages} />
}

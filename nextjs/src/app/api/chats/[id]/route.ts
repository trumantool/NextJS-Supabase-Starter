import { NextResponse, type NextRequest } from 'next/server'
import { getValidChatModel } from '@/lib/chat-openrouter'
import {
  messageContentFromUnknown,
  type ChatUiMessage,
} from '@/lib/chat-messages'
import {
  fetchTagsByChatIds,
  replaceChatTags,
  type TagRef,
} from '@/lib/chat-tags'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

async function requireOwnedChat(id: string) {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isUuid(id)) {
    return { error: NextResponse.json({ error: 'Invalid chat id' }, { status: 400 }) }
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('requireOwnedChat:', error)
    return { error: NextResponse.json({ error: 'Failed to load chat' }, { status: 500 }) }
  }
  if (!chat) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { supabase, user, chat }
}

/**
 * GET /api/chats/[id]
 * Chat row, messages, and tags. Owner only.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedChat(id)
    if ('error' in loaded && loaded.error) return loaded.error

    const { supabase, chat } = loaded
    const { data: rows, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load messages:', error)
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    const tagsByChat = await fetchTagsByChatIds(supabase, [chat.id])
    const messages: ChatUiMessage[] = (rows || [])
      .filter((row) => row.role === 'user' || row.role === 'assistant' || row.role === 'system')
      .map((row) => ({
        id: row.id,
        role: row.role as ChatUiMessage['role'],
        content: messageContentFromUnknown(row.content),
        created_at: row.created_at,
      }))

    return NextResponse.json({
      chat: { ...chat, tags: tagsByChat.get(chat.id) ?? [] },
      messages,
    })
  } catch (err) {
    console.error('Chat GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/chats/[id]
 * Rename, change model, or replace tags. Does not rebind agent_id.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedChat(id)
    if ('error' in loaded && loaded.error) return loaded.error

    const { supabase, user, chat } = loaded
    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown
      modelId?: unknown
      tagIds?: unknown
    }

    const updates: { title?: string | null; model_id?: string } = {}

    if (body.title !== undefined) {
      if (body.title === null) {
        updates.title = null
      } else if (typeof body.title !== 'string') {
        return NextResponse.json({ error: 'title must be a string.' }, { status: 400 })
      } else {
        const title = body.title.trim()
        updates.title = title ? title.slice(0, 120) : null
      }
    }

    if (body.modelId !== undefined) {
      updates.model_id = getValidChatModel(body.modelId, chat.model_id)
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('chats')
        .update(updates)
        .eq('id', chat.id)
        .eq('user_id', user.id)
      if (error) {
        console.error('Failed to update chat:', error)
        return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
      }
    }

    if (body.tagIds !== undefined) {
      if (!Array.isArray(body.tagIds)) {
        return NextResponse.json({ error: 'tagIds must be an array of UUIDs.' }, { status: 400 })
      }
      const tagError = await replaceChatTags(supabase, {
        chatId: chat.id,
        userId: user.id,
        tagIds: body.tagIds.filter((item): item is string => typeof item === 'string'),
      })
      if (tagError) {
        return NextResponse.json({ error: tagError }, { status: 400 })
      }
    }

    const { data: next } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat.id)
      .single()

    const tagsByChat = await fetchTagsByChatIds(supabase, [chat.id])
    return NextResponse.json({
      chat: {
        ...(next || chat),
        tags: tagsByChat.get(chat.id) ?? ([] as TagRef[]),
      },
    })
  } catch (err) {
    console.error('Chat PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/chats/[id]
 * Messages cascade. Owner only.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedChat(id)
    if ('error' in loaded && loaded.error) return loaded.error

    const { supabase, user, chat } = loaded
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chat.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete chat:', error)
      return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Chat DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

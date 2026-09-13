import { NextResponse, type NextRequest } from 'next/server'
import { modelIdFromDefaults } from '@/lib/agent-templates'
import { CHAT_AGENT_QUERY, parseChatAgentQueryParam } from '@/lib/chat-agent'
import { getPlatformChatModel, getValidChatModel } from '@/lib/chat-openrouter'
import { fetchTagsByChatIds, fetchUserTagCatalog, type TagRef } from '@/lib/chat-tags'
import type { ChatThread } from '@/lib/chat-types'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'

/**
 * GET /api/chats?agent-id=
 * List the current user's chats. Missing/empty agent-id = general (agent_id IS NULL).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentParam = parseChatAgentQueryParam(
      request.nextUrl.searchParams.get(CHAT_AGENT_QUERY)
    )

    if (agentParam && !isUuid(agentParam)) {
      return NextResponse.json({ error: 'agent-id must be a UUID.' }, { status: 400 })
    }

    let query = supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    query = agentParam ? query.eq('agent_id', agentParam) : query.is('agent_id', null)

    const { data, error } = await query
    if (error) {
      console.error('Failed to list chats:', error)
      return NextResponse.json({ error: 'Failed to list chats' }, { status: 500 })
    }

    const chats = data || []
    const [tagsByChat, catalog] = await Promise.all([
      fetchTagsByChatIds(
        supabase,
        chats.map((chat) => chat.id)
      ),
      fetchUserTagCatalog(supabase, user.id),
    ])

    const threads: ChatThread[] = chats.map((chat) => ({
      ...chat,
      tags: tagsByChat.get(chat.id) ?? [],
    }))

    return NextResponse.json({ chats: threads, tags: catalog })
  } catch (err) {
    console.error('Chats GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chats
 * Create a thread. agentId null/omitted = general chat.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown
      modelId?: unknown
      agentId?: unknown
    }

    let agentId: string | null = null
    if (body.agentId !== undefined && body.agentId !== null && body.agentId !== '') {
      if (!isUuid(body.agentId)) {
        return NextResponse.json({ error: 'agentId must be a UUID.' }, { status: 400 })
      }
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('id, defaults')
        .eq('id', body.agentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (agentError || !agent) {
        return NextResponse.json({ error: 'Agent not found.' }, { status: 404 })
      }
      agentId = agent.id
      if (!isModelIdProvided(body.modelId)) {
        body.modelId = modelIdFromDefaults(agent.defaults)
      }
    }

    const modelId = getValidChatModel(
      body.modelId,
      await getPlatformChatModel()
    )

    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : null

    const { data: chat, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        title,
        model_id: modelId,
        agent_id: agentId,
      })
      .select('*')
      .single()

    if (error || !chat) {
      console.error('Failed to create chat:', error)
      return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
    }

    return NextResponse.json({ chat: { ...chat, tags: [] as TagRef[] } }, { status: 201 })
  } catch (err) {
    console.error('Chats POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isModelIdProvided(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

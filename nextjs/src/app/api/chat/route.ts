import { NextResponse, type NextRequest } from 'next/server'
import { modelIdFromDefaults } from '@/lib/agent-templates'
import {
  buildAssistantContent,
  buildUserContent,
  contentToJson,
  flattenContentForModel,
  messageContentFromUnknown,
  parseAttachment,
  titleFromFirstMessage,
  type ChatAttachment,
} from '@/lib/chat-messages'
import { getValidChatModel, streamChatCompletion } from '@/lib/chat-openrouter'
import { loadAgentSkills } from '@/lib/load-agent-skills'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful workspace assistant. Be concise, accurate, and ask a clarifying question when the request is ambiguous. Follow any loaded skills as instructions.'

/**
 * POST /api/chat
 * Stream an OpenRouter reply and persist the turn.
 * No Composio / toolkit execution — skills are injected as system context only.
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
      chatId?: unknown
      modelId?: unknown
      agentId?: unknown
      message?: { text?: unknown; attachments?: unknown }
    }

    if (!isUuid(body.chatId)) {
      return NextResponse.json({ error: 'chatId is required.' }, { status: 400 })
    }

    const text = typeof body.message?.text === 'string' ? body.message.text : ''
    const attachments: ChatAttachment[] = Array.isArray(body.message?.attachments)
      ? body.message.attachments.flatMap((item) => {
          const parsed = parseAttachment(item)
          return parsed ? [parsed] : []
        })
      : []

    if (!text.trim() && attachments.length === 0) {
      return NextResponse.json({ error: 'Message text or an attachment is required.' }, { status: 400 })
    }

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', body.chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 })
    }

    let systemPrompt = DEFAULT_SYSTEM_PROMPT
    let modelId = getValidChatModel(body.modelId, chat.model_id)

    const boundAgentId = chat.agent_id
    if (boundAgentId) {
      if (body.agentId && body.agentId !== boundAgentId) {
        return NextResponse.json(
          { error: 'This thread is already bound to a different agent.' },
          { status: 400 }
        )
      }
      const { data: agent, error: agentError } = await supabase
        .from('user_agents')
        .select('id, name, system_prompt, skill_ids, defaults')
        .eq('id', boundAgentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (agentError || !agent) {
        return NextResponse.json({ error: 'Bound agent was not found.' }, { status: 404 })
      }

      const agentPrompt = agent.system_prompt?.trim()
      if (agentPrompt) systemPrompt = agentPrompt
      if (!isModelIdProvided(body.modelId)) {
        modelId = getValidChatModel(modelIdFromDefaults(agent.defaults), modelId)
      }

      const skills = await loadAgentSkills({
        supabase,
        ownerUserId: user.id,
        skillIds: agent.skill_ids,
      })
      if (skills.promptSection) systemPrompt += skills.promptSection
      if (skills.notes.length > 0) {
        systemPrompt += `\n\nSkill loader notes:\n- ${skills.notes.join('\n- ')}`
      }
    }

    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('Failed to load chat history:', historyError)
      return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 })
    }

    const userContent = buildUserContent(text, attachments)
    const { error: insertUserError } = await supabase.from('messages').insert({
      chat_id: chat.id,
      role: 'user',
      content: contentToJson(userContent),
    })
    if (insertUserError) {
      console.error('Failed to save user message:', insertUserError)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    if (!chat.title) {
      await supabase
        .from('chats')
        .update({
          title: titleFromFirstMessage(text || attachments[0]?.name || 'New chat'),
          model_id: modelId,
        })
        .eq('id', chat.id)
        .eq('user_id', user.id)
    } else if (modelId !== chat.model_id) {
      await supabase
        .from('chats')
        .update({ model_id: modelId })
        .eq('id', chat.id)
        .eq('user_id', user.id)
    }

    const prior = (history || [])
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: flattenContentForModel(messageContentFromUnknown(row.content)),
      }))
      .filter((row) => row.content.length > 0)

    const openrouterMessages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }> = [
      { role: 'system', content: systemPrompt },
      ...prior,
      { role: 'user', content: flattenContentForModel(userContent) },
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }
        try {
          const full = await streamChatCompletion({
            model: modelId,
            messages: openrouterMessages,
            onChunk: (delta) => send({ delta }),
            userId: user.id,
          })
          const { error: insertAssistantError } = await supabase.from('messages').insert({
            chat_id: chat.id,
            role: 'assistant',
            content: contentToJson(buildAssistantContent(full)),
          })
          if (insertAssistantError) {
            console.error('Failed to save assistant message:', insertAssistantError)
            send({ error: 'Reply generated but failed to save.' })
          } else {
            send({ done: true, chatId: chat.id })
          }
        } catch (err) {
          send({
            error: err instanceof Error ? err.message : 'AI request failed',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Chat generation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    )
  }
}

function isModelIdProvided(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

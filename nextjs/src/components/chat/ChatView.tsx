'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AgentSwitcher from '@/components/chat/AgentSwitcher'
import ChatComposer from '@/components/chat/ChatComposer'
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar'
import MessageItem from '@/components/chat/MessageItem'
import { CHAT_AGENT_QUERY, chatPathForAgent, chatsListPath, parseChatAgentQueryParam } from '@/lib/chat-agent'
import type { ChatThread } from '@/lib/chat-types'
import { DEFAULT_AGENT_MODEL, modelIdFromDefaults } from '@/lib/agent-templates'
import {
  buildAssistantContent,
  buildUserContent,
  type ChatAttachment,
  type ChatUiMessage,
} from '@/lib/chat-messages'
import { uploadChatAttachment } from '@/lib/chat-storage'
import type { TagRef } from '@/lib/chat-tags'
import { createSPAClient } from '@/lib/supabase/client'
import type { UserAgent } from '@/lib/types'

const EMPTY_PROMPTS = [
  {
    title: 'Explain a concept',
    prompt: 'Explain this idea in plain language, then give a short example I can reuse.',
  },
  {
    title: 'Draft a message',
    prompt: 'Help me draft a concise, professional message. Ask me who it is for if that is unclear.',
  },
  {
    title: 'Summarize notes',
    prompt: 'Summarize the key points and action items. I may attach a file.',
  },
  {
    title: 'Plan next steps',
    prompt: 'Turn this request into a short checklist with the first step I should take.',
  },
]

type ChatViewProps = {
  initialChat?: ChatThread | null
  initialMessages?: ChatUiMessage[]
}

export default function ChatView(props: ChatViewProps) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading chat…</div>}>
      <ChatViewInner {...props} />
    </Suspense>
  )
}

function ChatViewInner({ initialChat = null, initialMessages = [] }: ChatViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlAgentId = parseChatAgentQueryParam(searchParams.get(CHAT_AGENT_QUERY))

  const [agents, setAgents] = useState<UserAgent[]>([])
  const [chats, setChats] = useState<ChatThread[]>([])
  const [catalog, setCatalog] = useState<TagRef[]>([])
  const [messages, setMessages] = useState<ChatUiMessage[]>(initialMessages)
  const [activeChat, setActiveChat] = useState<ChatThread | null>(initialChat)
  const [agentId, setAgentId] = useState<string | null>(initialChat?.agent_id ?? urlAgentId)
  const [modelId, setModelId] = useState(initialChat?.model_id || DEFAULT_AGENT_MODEL)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) || null,
    [agents, agentId]
  )

  const loadAgents = useCallback(async () => {
    const res = await fetch('/api/agents', { cache: 'no-store' })
    const json = (await res.json()) as { agents?: UserAgent[]; error?: string }
    if (!res.ok) throw new Error(json.error || 'Failed to load agents')
    setAgents(json.agents || [])
    return json.agents || []
  }, [])

  const loadChats = useCallback(async (nextAgentId: string | null) => {
    const res = await fetch(chatsListPath(nextAgentId), { cache: 'no-store' })
    const json = (await res.json()) as {
      chats?: ChatThread[]
      tags?: TagRef[]
      error?: string
    }
    if (!res.ok) throw new Error(json.error || 'Failed to load chats')
    setChats(json.chats || [])
    setCatalog(json.tags || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await loadAgents()
        if (cancelled) return
        if (urlAgentId && !list.some((agent) => agent.id === urlAgentId) && !initialChat) {
          router.replace('/chat')
          return
        }
        await loadChats(initialChat?.agent_id ?? urlAgentId)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chat')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialChat, loadAgents, loadChats, router, urlAgentId])

  useEffect(() => {
    if (initialChat) return
    setAgentId(urlAgentId)
    setMessages([])
    setActiveChat(null)
    setPendingFiles([])
    const agent = agents.find((item) => item.id === urlAgentId)
    setModelId(agent ? modelIdFromDefaults(agent.defaults) : DEFAULT_AGENT_MODEL)
  }, [agents, initialChat, urlAgentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, generating])

  const changeAgent = (next: string | null) => {
    if (generating) return
    router.push(chatPathForAgent(next))
  }

  const ensureChat = async (): Promise<ChatThread> => {
    if (activeChat) return activeChat
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId,
        agentId,
      }),
    })
    const json = (await res.json()) as { chat?: ChatThread; error?: string }
    if (!res.ok || !json.chat) throw new Error(json.error || 'Failed to create chat')
    setActiveChat(json.chat)
    setChats((prev) => [json.chat!, ...prev.filter((item) => item.id !== json.chat!.id)])
    return json.chat
  }

  const send = async (text: string) => {
    setError('')
    setGenerating(true)
    const controller = new AbortController()
    abortRef.current = controller
    const assistantId = `assistant-${crypto.randomUUID()}`
    try {
      const chat = await ensureChat()
      const supabase = createSPAClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthorized')

      const attachments: ChatAttachment[] = []
      for (const file of pendingFiles) {
        attachments.push(
          await uploadChatAttachment({
            userId: user.id,
            chatId: chat.id,
            file,
          })
        )
      }
      setPendingFiles([])

      const userMessage: ChatUiMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        content: buildUserContent(text, attachments),
      }
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: buildAssistantContent('') },
      ])

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          modelId,
          agentId,
          message: { text, attachments },
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to generate a reply')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload) continue
          try {
            const json = JSON.parse(payload) as { delta?: string; error?: string; done?: boolean }
            if (json.error) throw new Error(json.error)
            if (typeof json.delta === 'string') {
              full += json.delta
              const snapshot = full
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: buildAssistantContent(snapshot) }
                    : message
                )
              )
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      await loadChats(agentId)
      if (!initialChat) {
        router.replace(`/chat/${chat.id}`)
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setMessages((prev) => prev.filter((message) => message.id !== assistantId || message.content.parts.some((part) => part.type === 'text' && part.text)))
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message')
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const renameChat = async (chatId: string, title: string) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) return
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)))
    if (activeChat?.id === chatId) setActiveChat({ ...activeChat, title })
  }

  const deleteChat = async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' })
    if (!res.ok) return
    setChats((prev) => prev.filter((chat) => chat.id !== chatId))
    if (activeChat?.id === chatId) {
      router.push(chatPathForAgent(agentId))
    }
  }

  const setTags = async (chatId: string, tagIds: string[]) => {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds }),
    })
    const json = (await res.json()) as { chat?: ChatThread }
    if (!res.ok || !json.chat) return
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? json.chat! : chat)))
  }

  const createTag = async (name: string): Promise<TagRef | null> => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const json = (await res.json()) as { tag?: TagRef; error?: string }
    if (!res.ok || !json.tag) {
      setError(json.error || 'Failed to create tag')
      return null
    }
    setCatalog((prev) => [...prev, json.tag!].toSorted((a, b) => a.name.localeCompare(b.name)))
    return json.tag
  }

  const empty = messages.length === 0 && !generating

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      <ChatHistorySidebar
        chats={chats}
        catalog={catalog}
        activeChatId={activeChat?.id}
        agentId={agentId}
        onNewChat={() => router.push(chatPathForAgent(agentId))}
        onRename={renameChat}
        onDelete={deleteChat}
        onSetTags={setTags}
        onCreateTag={createTag}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedAgent ? `Chat with ${selectedAgent.name}` : 'Chat'}
            </h1>
            <p className="text-xs text-gray-500">
              {selectedAgent
                ? 'This thread uses the selected agent’s prompt, model, and skills. History is only for this agent.'
                : 'General chat is not bound to an agent. Attach a skill-enabled agent anytime from the switcher.'}
            </p>
          </div>
          <AgentSwitcher
            id="header-agent-switcher"
            agents={agents}
            value={agentId}
            disabled={generating}
            onChange={changeAgent}
          />
        </header>
        {error ? (
          <div className="px-4 pt-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {empty ? (
            <div className="mx-auto max-w-2xl space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedAgent
                    ? `Chat with ${selectedAgent.name}`
                    : 'What can I help you with?'}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {selectedAgent
                    ? 'Ask anything. Attached skills are added as system context for this agent.'
                    : 'Start a general thread, or switch to one of your agents to use its skills.'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {EMPTY_PROMPTS.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => void send(card.prompt)}
                    className="rounded-xl border bg-gray-50 p-4 text-left hover:bg-gray-100"
                  >
                    <div className="font-medium text-gray-900">{card.title}</div>
                    <p className="mt-1 text-sm text-gray-500">{card.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <ChatComposer
          agents={agents}
          agentId={agentId}
          modelId={modelId}
          pendingFiles={pendingFiles}
          generating={generating}
          onAgentChange={changeAgent}
          onModelChange={setModelId}
          onFilesChange={setPendingFiles}
          onSubmit={(text) => void send(text)}
          onStop={() => abortRef.current?.abort()}
        />
      </section>
    </div>
  )
}

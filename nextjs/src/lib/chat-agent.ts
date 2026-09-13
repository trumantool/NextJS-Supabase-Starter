/** URL query key (kebab-case). Maps to DB column chats.agent_id. */
export const CHAT_AGENT_QUERY = 'agent-id'

export function chatPathForAgent(agentId: string | null | undefined): string {
  if (!agentId) return '/chat'
  return `/chat?${CHAT_AGENT_QUERY}=${encodeURIComponent(agentId)}`
}

export function chatsListPath(agentId: string | null | undefined): string {
  if (!agentId) return '/api/chats'
  return `/api/chats?${CHAT_AGENT_QUERY}=${encodeURIComponent(agentId)}`
}

export function parseChatAgentQueryParam(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

// Resume Builder — OpenRouter client (server-side only).
// Never expose the API key to the browser. The key is read from env.

import type { OpenRouterModel } from './types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'poolside/laguna-s-2.1:free'

/** Resolve the API key, preferring the primary var, falling back to the reachthem key. */
export function getOpenRouterKey(): string {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY_REACHTHEMAI ||
    ''
  )
}

/** List available models from OpenRouter (for the admin dropdown). */
export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const key = getOpenRouterKey()
  const res = await fetch(`${OPENROUTER_URL}/models`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`OpenRouter models request failed: ${res.status}`)
  }

  const json = (await res.json()) as { data?: OpenRouterModel[] }
  return json.data ?? []
}

/**
 * Stream a chat completion from OpenRouter.
 * Calls `onChunk` for each text delta. Returns the full text when done.
 */
export async function streamChatCompletion(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  onChunk: (delta: string) => void
  signal?: AbortSignal
}): Promise<string> {
  const key = getOpenRouterKey()
  const { model, messages, onChunk, signal } = opts

  const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter chat request failed: ${res.status} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE lines are separated by \n\n
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue

      try {
        const json = JSON.parse(payload)
        const delta = json?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          full += delta
          onChunk(delta)
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  return full
}

export { DEFAULT_MODEL }

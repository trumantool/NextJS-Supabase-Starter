// Documents — OpenRouter client (server-side only).
// Never expose the API key to the browser.

import { resolveOpenRouterKey } from '@/lib/byok'
import type { OpenRouterModel } from './types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'poolside/laguna-s-2.1:free'

/** Platform key for admin model listing. User BYOK is resolved per request. */
export async function getOpenRouterKey(userId?: string): Promise<string> {
  return resolveOpenRouterKey(userId)
}

/** List available models from OpenRouter (for the admin dropdown). */
export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
  const key = await getOpenRouterKey()
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

export type OpenRouterUsage = {
  inputTokens: number
  outputTokens: number
}

/**
 * Stream a chat completion from OpenRouter.
 * Calls `onChunk` for each text delta. Returns the full text and token usage.
 * Usage is present when OpenRouter sends a usage chunk (`stream_options.include_usage`).
 */
export async function streamChatCompletion(opts: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  onChunk: (delta: string) => void
  signal?: AbortSignal
  userId?: string
}): Promise<{ text: string; usage: OpenRouterUsage }> {
  const { model, messages, onChunk, signal, userId } = opts
  const key = await getOpenRouterKey(userId)

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
      stream_options: { include_usage: true },
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
  const usage: OpenRouterUsage = { inputTokens: 0, outputTokens: 0 }

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
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: unknown } }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            input_tokens?: number
            output_tokens?: number
          }
        }
        const delta = json?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          full += delta
          onChunk(delta)
        }
        if (json.usage) {
          const input = json.usage.prompt_tokens ?? json.usage.input_tokens
          const output = json.usage.completion_tokens ?? json.usage.output_tokens
          if (typeof input === 'number') usage.inputTokens = input
          if (typeof output === 'number') usage.outputTokens = output
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }

  return { text: full, usage }
}

export { DEFAULT_MODEL }

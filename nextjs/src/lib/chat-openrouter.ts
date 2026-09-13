import { DEFAULT_AGENT_MODEL, isModelId } from '@/lib/agent-templates'
import { streamChatCompletion } from '@/app/(dashboard)/documents/lib/openrouter'
import { createSSRClient } from '@/lib/supabase/server'

export const DEFAULT_CHAT_MODEL = DEFAULT_AGENT_MODEL

export function getValidChatModel(value: unknown, fallback = DEFAULT_CHAT_MODEL): string {
  if (isModelId(value)) return value.trim()
  return fallback
}

/** Admin-chosen platform default from app_settings, else starter default. */
export async function getPlatformChatModel(): Promise<string> {
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'openrouter_model')
    .maybeSingle()

  if (error) {
    console.error('getPlatformChatModel:', error)
    return DEFAULT_CHAT_MODEL
  }
  return getValidChatModel(data?.value, DEFAULT_CHAT_MODEL)
}

export { streamChatCompletion }

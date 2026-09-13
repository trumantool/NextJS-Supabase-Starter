/**
 * OpenRouter BYOK helpers.
 * The raw key lives in user_settings.openrouter_api_key and is readable only
 * with the service role. Authenticated clients never receive the full value.
 */
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

const OPENROUTER_KEY_PREFIX = 'sk-or-v1-'
const MIN_KEY_LENGTH = 20

export type ByokStatus = {
  hasKey: boolean
  hint: string | null
}

export function isOpenRouterKeyFormat(key: string): boolean {
  return key.startsWith(OPENROUTER_KEY_PREFIX) && key.length >= MIN_KEY_LENGTH
}

export function maskOpenRouterKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ''
  const last4 = trimmed.slice(-4)
  return `${OPENROUTER_KEY_PREFIX}••••${last4}`
}

async function requireUserId(): Promise<string> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user.id
}

export async function getByokStatusForCurrentUser(): Promise<ByokStatus> {
  const userId = await requireUserId()
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('user_settings')
    .select('openrouter_api_key')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const key = data?.openrouter_api_key?.trim() ?? ''
  if (!key) {
    return { hasKey: false, hint: null }
  }
  return { hasKey: true, hint: maskOpenRouterKey(key) }
}

export async function saveByokKeyForCurrentUser(rawKey: string): Promise<void> {
  const userId = await requireUserId()
  const key = rawKey.trim()
  if (!key) {
    throw new Error('Key is required')
  }
  if (!isOpenRouterKeyFormat(key)) {
    throw new Error('Invalid OpenRouter key format')
  }

  const admin = await createServerAdminClient()
  const { data: existing, error: readError } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (readError) {
    throw new Error(readError.message)
  }

  if (existing) {
    const { error } = await admin
      .from('user_settings')
      .update({ openrouter_api_key: key })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }

  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await admin.from('user_settings').insert({
    user_id: userId,
    email: user?.email ?? null,
    openrouter_api_key: key,
  })
  if (error) throw new Error(error.message)
}

export async function clearByokKeyForCurrentUser(): Promise<void> {
  const userId = await requireUserId()
  const admin = await createServerAdminClient()
  const { error } = await admin
    .from('user_settings')
    .update({ openrouter_api_key: null })
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/** Prefer the user's BYOK key; fall back to the platform OPENROUTER_API_KEY. */
export async function resolveOpenRouterKey(userId?: string): Promise<string> {
  if (userId) {
    const admin = await createServerAdminClient()
    const { data } = await admin
      .from('user_settings')
      .select('openrouter_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    const byok = data?.openrouter_api_key?.trim()
    if (byok) return byok
  }
  return process.env.OPENROUTER_API_KEY?.trim() || ''
}

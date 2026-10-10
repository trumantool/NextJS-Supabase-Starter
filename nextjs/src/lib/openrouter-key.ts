/**
 * Platform OpenRouter key resolution.
 * Order: user BYOK, then admin_settings.openrouter_api_key, then OPENROUTER_API_KEY.
 * openrouter_force_platform_key skips BYOK.
 * Secret admin rows are read with the service role. Values are never returned to the browser.
 */
import { readScopedAdminSettings } from '@/lib/admin-settings-server'
import { isForcePlatformKey, pickOpenRouterKey } from '@/lib/openrouter-key-resolve'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

const FORCE_OPTION = 'openrouter_force_platform_key'
const ADMIN_KEY_OPTION = 'openrouter_api_key'

export { isForcePlatformKey, pickOpenRouterKey }

export async function resolveOpenRouterKey(userId?: string): Promise<string> {
  let byName = new Map<string, string>()
  try {
    byName = await readScopedAdminSettings([FORCE_OPTION, ADMIN_KEY_OPTION])
  } catch (error) {
    console.error(
      'resolveOpenRouterKey admin settings:',
      error instanceof Error ? error.message : error
    )
  }

  const forcePlatform = isForcePlatformKey(byName.get(FORCE_OPTION))

  let byok = ''
  if (!forcePlatform && userId) {
    const admin = await createServerAdminClient()
    const { data, error } = await admin
      .from('user_settings')
      .select('openrouter_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.error('resolveOpenRouterKey byok:', error.message)
    } else {
      byok = data?.openrouter_api_key ?? ''
    }
  }

  return pickOpenRouterKey({
    byok,
    adminKey: byName.get(ADMIN_KEY_OPTION),
    envKey: process.env.OPENROUTER_API_KEY,
    forcePlatform,
  })
}

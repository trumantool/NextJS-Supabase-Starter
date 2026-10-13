/**
 * Platform YouTube Data API key for the future autoblogging feature.
 * Stored in admin_settings.youtube_data_api_key and read with the service role
 * through the same app_key scope as the OpenRouter admin key.
 * The value is never returned to the browser.
 */
import { readScopedAdminSettings } from '@/lib/admin-settings-server'
import { YOUTUBE_DATA_API_KEY_OPTION } from '@/lib/admin-setting-secrets'

export async function getYoutubeDataApiKey(): Promise<string> {
  try {
    const settings = await readScopedAdminSettings([YOUTUBE_DATA_API_KEY_OPTION])
    return settings.get(YOUTUBE_DATA_API_KEY_OPTION)?.trim() ?? ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('getYoutubeDataApiKey:', message)
    return ''
  }
}

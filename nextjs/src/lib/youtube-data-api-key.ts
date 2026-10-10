/**
 * Platform YouTube Data API key for the future autoblogging feature.
 * Stored in admin_settings.youtube_data_api_key and read with the service role.
 * The value is never returned to the browser.
 */
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { YOUTUBE_DATA_API_KEY_OPTION } from '@/lib/admin-setting-secrets'

export async function getYoutubeDataApiKey(): Promise<string> {
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('admin_settings')
    .select('option_value')
    .eq('option_name', YOUTUBE_DATA_API_KEY_OPTION)
    .maybeSingle()

  if (error) {
    console.error('getYoutubeDataApiKey:', error.message)
    return ''
  }

  return data?.option_value?.trim() ?? ''
}

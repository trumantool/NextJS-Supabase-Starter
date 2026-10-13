'use server'

import { Tables } from '@/lib/types'
import { loadPublicLegalSettings, upsertLegalSettings } from '@/lib/actions/legal-settings'

type AdminSetting = Tables<'admin_settings'>

/**
 * Fetches the admin settings needed to render the privacy page.
 * This is intentionally public (no auth required) so the /privacy page can be
 * viewed by anyone. Only the specific settings used for rendering are returned.
 */
export async function getPrivacySettings(): Promise<AdminSetting[]> {
  return loadPublicLegalSettings()
}

/**
 * Updates the privacy policy content. Only accessible to admin users.
 */
export async function updatePrivacyPolicy(
  content: string
): Promise<AdminSetting> {
  const [saved] = await upsertLegalSettings({ privacy_policy: content })
  if (!saved) throw new Error('Failed to save setting')
  return saved
}
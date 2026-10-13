'use server'

import { Tables } from '@/lib/types'
import { loadPublicLegalSettings, upsertLegalSettings } from '@/lib/actions/legal-settings'

type AdminSetting = Tables<'admin_settings'>

/**
 * Fetches the admin settings needed to render the Terms of Service page.
 * This is intentionally public (no auth required) so the /terms page can be
 * viewed by anyone. Only the specific settings used for rendering are returned.
 */
export async function getTermsSettings(): Promise<AdminSetting[]> {
  return loadPublicLegalSettings()
}

/**
 * Updates the Terms of Service content. Only accessible to admin users.
 */
export async function updateTermsOfService(
  content: string
): Promise<AdminSetting> {
  const [saved] = await upsertLegalSettings({ terms_of_service: content })
  if (!saved) throw new Error('Failed to save setting')
  return saved
}
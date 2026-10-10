'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { Tables } from '@/lib/types'
import { ADMIN_SETTINGS_COLUMNS, filterByAdminSettingsAppKey } from '@/lib/admin-settings-scope'
import {
  configuredAdminSettingsAppKey,
  dropConcealedAdminSettings,
  requireCurrentUserAdmin,
  upsertScopedAdminSetting,
} from '@/lib/admin-settings-server'

type AdminSetting = Tables<'admin_settings'>

/**
 * Fetches the admin settings needed to render the privacy page.
 * This is intentionally public (no auth required) so the /privacy page can be
 * viewed by anyone. Only the specific settings used for rendering are returned.
 */
export async function getPrivacySettings(): Promise<AdminSetting[]> {
  const supabase = await createSSRClient()

  const scoped = filterByAdminSettingsAppKey(
    supabase
      .from('admin_settings')
      .select(ADMIN_SETTINGS_COLUMNS)
      .in('option_name', [
        'privacy_policy',
        'site_title',
        'company_name',
        'support_email',
        'site_tagline',
        'contact_address',
        'support_hours',
        'phone_number',
      ])
      .neq('option_field_type', 'secret')
      .neq('option_field_type', 'password'),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped

  if (error) {
    console.error('Failed to load privacy settings:', error)
    throw new Error('Failed to load privacy settings')
  }

  return dropConcealedAdminSettings((data ?? []) as AdminSetting[])
}

/**
 * Updates the privacy policy content. Only accessible to admin users.
 */
export async function updatePrivacyPolicy(
  content: string
): Promise<AdminSetting> {
  await requireCurrentUserAdmin()

  const appKey = configuredAdminSettingsAppKey()
  const admin = await createServerAdminClient()
  const existingQuery = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select(ADMIN_SETTINGS_COLUMNS).eq('option_name', 'privacy_policy'),
    appKey
  )
  const { data: existing, error: readError } = await existingQuery.maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!existing) throw new Error('Setting not found')

  const saved = await upsertScopedAdminSetting({
    option_name: existing.option_name,
    option_value: content,
    option_field_type: existing.option_field_type,
    option_title: existing.option_title,
    option_description: existing.option_description,
    updated_at: new Date().toISOString(),
  })
  return saved as AdminSetting
}
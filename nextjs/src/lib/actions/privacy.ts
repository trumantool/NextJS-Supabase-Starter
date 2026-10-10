'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { Tables } from '@/lib/types'
import { filterByAdminSettingsAppKey } from '@/lib/admin-settings-scope'
import {
  configuredAdminSettingsAppKey,
  dropConcealedAdminSettings,
  requireCurrentUserAdmin,
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
      .select('*')
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

  const admin = await createServerAdminClient()
  const scoped = filterByAdminSettingsAppKey(
    admin
      .from('admin_settings')
      .update({ option_value: content, updated_at: new Date().toISOString() })
      .eq('option_name', 'privacy_policy'),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped.select().single()

  if (error) throw new Error(error.message)
  return data as AdminSetting
}
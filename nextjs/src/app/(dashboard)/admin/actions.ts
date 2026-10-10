'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { Tables } from '@/lib/types'
import {
  filterByAdminSettingsAppKey,
  isConcealedAdminField,
  presentAdminSettingForBrowser,
  resolveAdminSettingWrite,
} from '@/lib/admin-settings-scope'
import {
  configuredAdminSettingsAppKey,
  dropConcealedAdminSettings,
  requireCurrentUserAdmin,
} from '@/lib/admin-settings-server'

type AdminSetting = Tables<'admin_settings'>

export type AdminSettingView = AdminSetting & { secret_is_set: boolean }

function presentAdminSetting(row: AdminSetting): AdminSettingView {
  return presentAdminSettingForBrowser(row)
}

/**
 * Checks whether the current authenticated user has the 'admin' role.
 * Returns false for anonymous users.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.user_role === 'admin'
}

/**
 * Fetches all admin settings. Only accessible to admin users.
 */
export async function getAdminSettings(): Promise<AdminSettingView[]> {
  await requireCurrentUserAdmin()

  // Service role sees secret and password rows. Values are blanked before the browser.
  const admin = await createServerAdminClient()
  const scoped = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select('*').order('created_at', { ascending: true }),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped

  if (error) throw new Error(error.message)
  return ((data ?? []) as AdminSetting[]).map(presentAdminSetting)
}

/**
 * Fetches non-secret admin settings by option name for this deployment.
 * RLS allows anon and authenticated SELECT of rows whose option_field_type
 * is not secret or password. Concealed names are dropped. Missing options
 * are absent from the map so callers can fall back to defaults.
 */
export async function getAdminSettingsByNames(
  names: string[]
): Promise<Record<string, string>> {
  const supabase = await createSSRClient()
  const scoped = filterByAdminSettingsAppKey(
    supabase
      .from('admin_settings')
      .select('option_name, option_value, option_field_type')
      .in('option_name', names)
      .neq('option_field_type', 'secret')
      .neq('option_field_type', 'password'),
    configuredAdminSettingsAppKey()
  )

  const { data, error } = await scoped

  if (error) {
    console.error('Failed to fetch admin settings:', error)
    return {}
  }

  const result: Record<string, string> = {}
  for (const row of dropConcealedAdminSettings(data ?? [])) {
    result[row.option_name] = row.option_value
  }
  return result
}

/**
 * Updates a single admin setting's value. Only accessible to admin users.
 */
export async function updateAdminSetting(
  id: string,
  optionValue: string,
  options?: { clearSecret?: boolean }
): Promise<AdminSettingView> {
  await requireCurrentUserAdmin()

  const admin = await createServerAdminClient()
  const appKey = configuredAdminSettingsAppKey()
  const existingQuery = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select('*').eq('id', id),
    appKey
  )
  const { data: existing, error: readError } = await existingQuery.maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!existing) throw new Error('Setting not found')

  const row = existing as AdminSetting
  const write = resolveAdminSettingWrite(
    row.option_field_type,
    row.option_value,
    optionValue,
    options?.clearSecret === true && isConcealedAdminField(row.option_field_type)
  )
  if (write.keepExisting) return presentAdminSetting(row)

  const updateQuery = filterByAdminSettingsAppKey(
    admin
      .from('admin_settings')
      .update({ option_value: write.optionValue, updated_at: new Date().toISOString() })
      .eq('id', id),
    appKey
  )
  const { data, error } = await updateQuery.select().single()

  if (error) throw new Error(error.message)
  return presentAdminSetting(data as AdminSetting)
}

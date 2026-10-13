'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { Tables } from '@/lib/types'
import {
  ADMIN_SETTINGS_COLUMNS,
  filterByAdminSettingsAppKey,
  isConcealedAdminField,
  presentAdminSettingForBrowser,
  resolveAdminSettingWrite,
} from '@/lib/admin-settings-scope'
import {
  configuredAdminSettingsAppKey,
  dropConcealedAdminSettings,
  requireCurrentUserAdmin,
  upsertScopedAdminSetting,
} from '@/lib/admin-settings-server'
import {
  OPENROUTER_API_KEY_OPTION,
  YOUTUBE_DATA_API_KEY_OPTION,
} from '@/lib/admin-setting-secrets'

type AdminSetting = Tables<'admin_settings'>

export type AdminSettingView = AdminSetting & { secret_is_set: boolean }

function placeYoutubeKeyBesideOpenRouter<T extends { option_name: string }>(rows: T[]): T[] {
  const youtubeIndex = rows.findIndex((row) => row.option_name === YOUTUBE_DATA_API_KEY_OPTION)
  const openRouterIndex = rows.findIndex((row) => row.option_name === OPENROUTER_API_KEY_OPTION)
  if (youtubeIndex < 0 || openRouterIndex < 0 || youtubeIndex === openRouterIndex + 1) {
    return rows
  }
  const next = rows.slice()
  const [youtube] = next.splice(youtubeIndex, 1)
  if (!youtube) return rows
  const insertAt = next.findIndex((row) => row.option_name === OPENROUTER_API_KEY_OPTION)
  next.splice(insertAt + 1, 0, youtube)
  return next
}

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
    admin.from('admin_settings').select(ADMIN_SETTINGS_COLUMNS).order('created_at', { ascending: true }),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped

  if (error) throw new Error(error.message)
  const presented = ((data ?? []) as AdminSetting[]).map(presentAdminSetting)
  return placeYoutubeKeyBesideOpenRouter(presented)
}

/**
 * Fetches non-secret admin settings by option name for this deployment.
 * RLS allows anon and authenticated SELECT of rows whose option_field_type
 * is not secret or password. Concealed rows, including youtube_data_api_key,
 * are dropped. Missing options are absent from the map so callers can fall
 * back to defaults.
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

  const appKey = configuredAdminSettingsAppKey()
  const admin = await createServerAdminClient()
  const existingQuery = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select(ADMIN_SETTINGS_COLUMNS).eq('id', id),
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

  const saved = await upsertScopedAdminSetting({
    option_name: row.option_name,
    option_value: write.optionValue,
    option_field_type: row.option_field_type,
    option_title: row.option_title,
    option_description: row.option_description,
    updated_at: new Date().toISOString(),
  })
  return presentAdminSetting(saved as AdminSetting)
}

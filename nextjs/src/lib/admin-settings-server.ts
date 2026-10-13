/**
 * Server-only admin_settings access.
 * Secret and password values are read here with the service role, never with
 * the anon or authenticated client, and never from a client component.
 */
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import {
  ADMIN_SETTINGS_COLUMNS,
  adminSettingsAppKey,
  adminSettingsSave,
  filterByAdminSettingsAppKey,
  isConcealedAdminField,
  type AdminSettingUpsertRow,
} from '@/lib/admin-settings-scope'

export function configuredAdminSettingsAppKey(): string | null {
  return adminSettingsAppKey(process.env.ADMIN_SETTINGS_APP_KEY)
}

export async function requireCurrentUserAdmin(): Promise<void> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (data?.user_role !== 'admin') {
    throw new Error('Forbidden: admin access required')
  }
}

/** Service-role read of this deployment's rows, including concealed values. */
export async function readScopedAdminSettings(
  names: readonly string[]
): Promise<Map<string, string>> {
  const admin = await createServerAdminClient()
  const scoped = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select('option_name, option_value, option_field_type').in('option_name', [...names]),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped

  if (error) throw new Error(error.message)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.option_name, row.option_value)
  }
  return map
}

/** Upsert one row. Unscoped conflict is option_name and the payload has no app_key. */
export async function upsertScopedAdminSetting(row: AdminSettingUpsertRow) {
  const appKey = configuredAdminSettingsAppKey()
  const save = adminSettingsSave(appKey, row)
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('admin_settings')
    .upsert(save.row, { onConflict: save.onConflict })
    .select(ADMIN_SETTINGS_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export function dropConcealedAdminSettings<T extends { option_field_type: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isConcealedAdminField(row.option_field_type))
}

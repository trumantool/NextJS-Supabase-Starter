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
import {
  LEGAL_PUBLIC_SETTING_NAMES,
  legalSettingWrite,
  publicLegalSettingsResult,
} from '@/lib/legal-pages'
import { isMissingBlogSchemaError } from '@/lib/posts'

type AdminSetting = Tables<'admin_settings'>

const MISSING_LEGAL_SETTINGS =
  'Legal settings are unavailable because admin_settings is missing. Nothing was saved.'

/**
 * Public read of the settings /terms and /privacy render.
 * A missing table or column returns an empty list so the page can use fallback copy.
 */
export async function loadPublicLegalSettings(): Promise<AdminSetting[]> {
  const supabase = await createSSRClient()
  const scoped = filterByAdminSettingsAppKey(
    supabase
      .from('admin_settings')
      .select(ADMIN_SETTINGS_COLUMNS)
      .in('option_name', [...LEGAL_PUBLIC_SETTING_NAMES])
      .neq('option_field_type', 'secret')
      .neq('option_field_type', 'password'),
    configuredAdminSettingsAppKey()
  )
  const { data, error } = await scoped
  const result = publicLegalSettingsResult(error, (data ?? null) as AdminSetting[] | null)
  if ('failed' in result) {
    console.error('Failed to load legal settings:', error)
    throw new Error('Failed to load legal settings')
  }
  if (result.missingSchema) {
    console.warn(
      `Legal settings unavailable: ${error?.code ?? 'unknown'} ${error?.message ?? ''}`.trim()
    )
  }
  return dropConcealedAdminSettings(result.rows)
}

/** Upserts allowlisted legal rows, creating a missing key instead of failing the save. */
export async function upsertLegalSettings(
  fields: Record<string, string>
): Promise<AdminSetting[]> {
  await requireCurrentUserAdmin()
  const names = Object.keys(fields)
  if (names.length === 0) throw new Error('No settings to save')
  for (const name of names) {
    if (!legalSettingWrite(name, '', null, '')) throw new Error('Setting not found')
  }

  const appKey = configuredAdminSettingsAppKey()
  const admin = await createServerAdminClient()
  const existingQuery = filterByAdminSettingsAppKey(
    admin.from('admin_settings').select(ADMIN_SETTINGS_COLUMNS).in('option_name', names),
    appKey
  )
  const { data: existingRows, error: readError } = await existingQuery
  if (readError) {
    if (isMissingBlogSchemaError(readError)) throw new Error(MISSING_LEGAL_SETTINGS)
    throw new Error(readError.message)
  }

  const byName = new Map((existingRows ?? []).map((row) => [row.option_name, row]))
  const now = new Date().toISOString()
  const saved: AdminSetting[] = []
  for (const name of names) {
    const existing = byName.get(name) ?? null
    const row = legalSettingWrite(name, fields[name] ?? '', existing, now)
    if (!row) throw new Error('Setting not found')
    try {
      const result = await upsertScopedAdminSetting(row)
      saved.push(result as AdminSetting)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save setting'
      if (/42P01|42703|PGRST200|PGRST204|PGRST205/i.test(message)) {
        throw new Error(MISSING_LEGAL_SETTINGS)
      }
      throw err instanceof Error ? err : new Error(message)
    }
  }
  return saved
}

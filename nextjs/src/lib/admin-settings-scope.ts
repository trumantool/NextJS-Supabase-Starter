/**
 * Pure helpers for admin_settings masking and per-app scope.
 * Safe to import from client components. No Supabase client and no secret values.
 *
 * ADMIN_SETTINGS_APP_KEY unset (or blank) does not mention app_key. That keeps
 * a database whose admin_settings table has no app_key column working: reads
 * and writes use option_name only. A clone that has applied the app_key
 * migration sets the env var and filters plus upserts on (app_key, option_name).
 */

export const ADMIN_SETTINGS_APP_KEY_ENV = 'ADMIN_SETTINGS_APP_KEY'

const MARKUP_PATTERN = /^-?\d+(\.\d+)?$/

/** Blank and unset both mean unscoped: do not read or write app_key. */
export function adminSettingsAppKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Columns on the shared admin_settings table. app_key is omitted so an
 * unscoped select does not require the column.
 */
export const ADMIN_SETTINGS_COLUMNS =
  'id, option_name, option_value, option_field_type, option_title, option_description, created_at, updated_at' as const

export type AdminSettingUpsertRow = {
  option_name: string
  option_value: string
  option_field_type: string
  option_title: string
  option_description: string | null
  updated_at: string
}

export type AdminSettingsSave = {
  onConflict: 'option_name' | 'app_key,option_name'
  row: AdminSettingUpsertRow & { app_key?: string }
}

/**
 * Unscoped saves conflict on option_name and never include app_key.
 * Scoped saves keep the (app_key, option_name) pair.
 */
export function adminSettingsSave(
  appKey: string | null,
  row: AdminSettingUpsertRow & { app_key?: string | null }
): AdminSettingsSave {
  const rest: AdminSettingUpsertRow = {
    option_name: row.option_name,
    option_value: row.option_value,
    option_field_type: row.option_field_type,
    option_title: row.option_title,
    option_description: row.option_description,
    updated_at: row.updated_at,
  }
  if (appKey === null || appKey.trim() === '') {
    return { onConflict: 'option_name', row: rest }
  }
  return { onConflict: 'app_key,option_name', row: { ...rest, app_key: appKey } }
}

export function isConcealedAdminField(fieldType: string | null | undefined): boolean {
  return fieldType === 'secret' || fieldType === 'password'
}

type AppKeyEq = {
  eq: (column: 'app_key', value: string) => unknown
}

/**
 * PostgREST filter. Unscoped queries are returned unchanged so the request
 * never mentions app_key. Scoped queries add eq('app_key', value).
 */
export function filterByAdminSettingsAppKey<Q>(query: Q, appKey: string | null): Q {
  if (appKey === null || appKey.trim() === '') return query
  return (query as unknown as AppKeyEq).eq('app_key', appKey) as Q
}

export function matchesAdminSettingsAppKey(
  rowAppKey: string | null | undefined,
  configured: string | null
): boolean {
  if (configured === null) return rowAppKey == null || rowAppKey === ''
  return rowAppKey === configured
}

export function filterAdminSettingsByAppKey<T extends { app_key: string | null | undefined }>(
  rows: readonly T[],
  appKey: string | null
): T[] {
  return rows.filter((row) => matchesAdminSettingsAppKey(row.app_key, appKey))
}

export function presentAdminSettingForBrowser<T extends { option_value: string; option_field_type: string }>(
  row: T
): T & { secret_is_set: boolean } {
  if (!isConcealedAdminField(row.option_field_type)) {
    return { ...row, secret_is_set: false }
  }
  const value = row.option_value ?? ''
  return {
    ...row,
    option_value: '',
    secret_is_set: value.trim().length > 0,
  }
}

/**
 * Secret and password fields are write-only in the admin UI.
 * An empty submission keeps the stored value. clearSecret stores an empty string.
 * Other field types save the submitted string, including empty.
 */
export function resolveAdminSettingWrite(
  fieldType: string,
  currentValue: string,
  submittedValue: string,
  clearSecret: boolean
): { optionValue: string; keepExisting: boolean } {
  if (!isConcealedAdminField(fieldType)) {
    return { optionValue: submittedValue, keepExisting: false }
  }
  if (clearSecret) {
    return { optionValue: '', keepExisting: false }
  }
  if (!submittedValue.trim()) {
    return { optionValue: currentValue, keepExisting: true }
  }
  return { optionValue: submittedValue.trim(), keepExisting: false }
}

/**
 * Markup passed to record_llm_turn_usage.
 * A failed unscoped read returns null so SQL can use its own markup fallback.
 * A failed read with an app key returns 0 so another app's row is not used.
 */
export function ledgerMarkupArgument(
  appKey: string | null,
  raw: string | null | undefined,
  readFailed: boolean
): number | null {
  if (readFailed || raw == null) {
    return appKey === null ? null : 0
  }
  const trimmed = raw.trim()
  if (!MARKUP_PATTERN.test(trimmed)) return 0
  return Number(trimmed)
}

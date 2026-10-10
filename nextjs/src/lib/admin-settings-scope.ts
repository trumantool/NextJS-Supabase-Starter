/**
 * Pure helpers for admin_settings masking and per-app scope.
 * Safe to import from client components. No Supabase client and no secret values.
 *
 * ADMIN_SETTINGS_APP_KEY unset (or blank) selects rows whose app_key is NULL.
 * That is the single-app starter: existing and seeded rows keep working.
 * A shared-database clone sets the env var and only sees rows with that key.
 */

export const ADMIN_SETTINGS_APP_KEY_ENV = 'ADMIN_SETTINGS_APP_KEY'

const MARKUP_PATTERN = /^-?\d+(\.\d+)?$/

/** Blank and unset both mean the NULL app_key rows (single-app starter). */
export function adminSettingsAppKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function isConcealedAdminField(fieldType: string | null | undefined): boolean {
  return fieldType === 'secret' || fieldType === 'password'
}

type AppKeyFilter = {
  eq: (column: 'app_key', value: string) => unknown
  is: (column: 'app_key', value: null) => unknown
}

/** PostgREST filter: NULL app_key when the env var is unset, else equality. */
export function filterByAdminSettingsAppKey<Q>(query: Q, appKey: string | null): Q {
  const builder = query as unknown as AppKeyFilter
  if (appKey === null) {
    return builder.is('app_key', null) as Q
  }
  return builder.eq('app_key', appKey) as Q
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
 * A failed read with no app key returns null so SQL can read the NULL app_key row.
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

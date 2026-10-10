/**
 * Secret admin_settings option names.
 * Public and non-admin readers must drop these before returning values.
 * RLS also hides option_field_type = 'secret' from anon and authenticated SELECT.
 */
export const OPENROUTER_API_KEY_OPTION = 'openrouter_api_key'
export const YOUTUBE_DATA_API_KEY_OPTION = 'youtube_data_api_key'

export const SECRET_ADMIN_SETTING_NAMES = [
  OPENROUTER_API_KEY_OPTION,
  YOUTUBE_DATA_API_KEY_OPTION,
] as const

const secretAdminSettingNames = new Set<string>(SECRET_ADMIN_SETTING_NAMES)

export function isSecretAdminSetting(name: string): boolean {
  return secretAdminSettingNames.has(name)
}

/** Names safe to request from a public or non-admin admin_settings read. */
export function publicAdminSettingNames(names: readonly string[]): string[] {
  return names.filter((name) => !secretAdminSettingNames.has(name))
}

/** Drops secret rows if a public query ever returns them. */
export function omitSecretAdminSettings<T extends { option_name: string }>(
  rows: readonly T[]
): T[] {
  return rows.filter((row) => !secretAdminSettingNames.has(row.option_name))
}

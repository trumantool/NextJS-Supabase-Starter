import type { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

/**
 * A shortcode is a token like [site_title] embedded in admin-setting content
 * that gets replaced with the value of another admin setting at render time.
 *
 * The map below defines which admin setting each shortcode resolves to.
 * Add new shortcodes here as new admin settings are introduced.
 */
export const SHORTCODE_MAP: Record<string, string> = {
  site_title: 'site_title',
  company_name: 'company_name',
  support_email: 'support_email',
  site_tagline: 'site_tagline',
  contact_address: 'contact_address',
  support_hours: 'support_hours',
  phone_number: 'phone_number',
}

/**
 * Builds a lookup of option_name -> option_value from a list of admin settings.
 */
export function buildSettingsMap(
  settings: AdminSetting[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const setting of settings) {
    map[setting.option_name] = setting.option_value
  }
  return map
}

/**
 * Replaces every known shortcode (e.g. [site_title]) in `content` with the
 * corresponding admin setting value. Unknown shortcodes are left untouched.
 *
 * @param content  The raw content that may contain shortcodes.
 * @param settings A list of admin settings used to resolve shortcode values.
 */
export function resolveShortcodes(
  content: string,
  settings: AdminSetting[]
): string {
  const map = buildSettingsMap(settings)

  return content.replace(/\[([a-z_]+)\]/gi, (match, name: string) => {
    const key = name.toLowerCase()
    const settingName = SHORTCODE_MAP[key]
    if (!settingName) return match
    const value = map[settingName]
    return value !== undefined && value !== null ? value : match
  })
}
import { isMissingBlogSchemaError } from './posts'
import { SHORTCODE_MAP } from './shortcodes'

/** Public admin_settings keys the legal pages may read. Secrets are not in this list. */
export const LEGAL_PUBLIC_SETTING_NAMES = [
  'terms_of_service',
  'privacy_policy',
  'site_title',
  'company_name',
  'site_url',
  'contact_email',
  'support_email',
  'effective_date',
  'site_tagline',
  'contact_address',
  'support_hours',
  'phone_number',
] as const

export const LEGAL_VALUE_FALLBACKS: Record<string, string> = {
  company_name: 'the site operator',
  site_url: 'this website',
  contact_email: 'the contact email published for this site',
  effective_date: 'the date this page was last updated',
  site_title: 'this site',
  support_email: 'the contact email published for this site',
}

export const GENERIC_TERMS_HTML = `<h1>Terms of Service</h1>
<p>These terms govern use of the service operated by [company_name]. They are effective [effective_date].</p>
<p>The service is available at [site_url]. Questions about these terms can be sent to [contact_email].</p>
<p>By using the service, you agree to these terms. If you do not agree, do not use the service.</p>`

export const GENERIC_PRIVACY_HTML = `<h1>Privacy Policy</h1>
<p>[company_name] describes here how information is collected, used, and protected when you use the service at [site_url].</p>
<p>This policy is effective [effective_date]. Privacy questions can be sent to [contact_email].</p>`

export type LegalKind = 'terms' | 'privacy'

export type LegalSettingLike = {
  option_name: string
  option_value: string | null
}

export type LegalFieldMeta = {
  option_name: string
  option_field_type: 'text' | 'textarea'
  option_title: string
  option_description: string
}

export const LEGAL_IDENTITY_FIELDS: readonly LegalFieldMeta[] = [
  {
    option_name: 'company_name',
    option_field_type: 'text',
    option_title: 'Company name',
    option_description: 'Legal name of the operator. Shortcode [company_name].',
  },
  {
    option_name: 'site_url',
    option_field_type: 'text',
    option_title: 'Site URL',
    option_description: 'Public address of this site. Shortcode [site_url].',
  },
  {
    option_name: 'contact_email',
    option_field_type: 'text',
    option_title: 'Contact email',
    option_description: 'Public contact email. Shortcode [contact_email].',
  },
  {
    option_name: 'effective_date',
    option_field_type: 'text',
    option_title: 'Effective date',
    option_description: 'Date these legal pages take effect. Shortcode [effective_date].',
  },
]

const LEGAL_BODY_FIELDS: Record<'terms_of_service' | 'privacy_policy', Omit<LegalFieldMeta, 'option_name'>> = {
  terms_of_service: {
    option_field_type: 'textarea',
    option_title: 'Terms of Service',
    option_description:
      'HTML shown on /terms. Supports [company_name], [site_url], [contact_email], and [effective_date].',
  },
  privacy_policy: {
    option_field_type: 'textarea',
    option_title: 'Privacy Policy',
    option_description:
      'HTML shown on /privacy. Supports [company_name], [site_url], [contact_email], and [effective_date].',
  },
}

export function legalBodyName(kind: LegalKind): 'terms_of_service' | 'privacy_policy' {
  return kind === 'terms' ? 'terms_of_service' : 'privacy_policy'
}

export function genericLegalHtml(kind: LegalKind): string {
  return kind === 'terms' ? GENERIC_TERMS_HTML : GENERIC_PRIVACY_HTML
}

export function legalFieldMeta(optionName: string): LegalFieldMeta | null {
  const identity = LEGAL_IDENTITY_FIELDS.find((field) => field.option_name === optionName)
  if (identity) return identity
  if (optionName === 'terms_of_service' || optionName === 'privacy_policy') {
    return { option_name: optionName, ...LEGAL_BODY_FIELDS[optionName] }
  }
  return null
}

export type LegalSettingWrite = {
  option_name: string
  option_value: string
  option_field_type: string
  option_title: string
  option_description: string | null
  updated_at: string
}

type ExistingLegalRow = {
  option_field_type: string
  option_title: string
  option_description: string | null
}

/** Builds an upsert row. Returns null for names outside the legal allowlist or for concealed rows. */
export function legalSettingWrite(
  optionName: string,
  optionValue: string,
  existing: ExistingLegalRow | null,
  updatedAt: string
): LegalSettingWrite | null {
  const meta = legalFieldMeta(optionName)
  if (!meta) return null
  if (existing?.option_field_type === 'secret' || existing?.option_field_type === 'password') return null
  return {
    option_name: optionName,
    option_value: optionValue,
    option_field_type: existing?.option_field_type || meta.option_field_type,
    option_title: existing?.option_title || meta.option_title,
    option_description: existing?.option_description ?? meta.option_description,
    updated_at: updatedAt,
  }
}

export function publicLegalSettingsResult<T>(
  error: { code?: string | null; message?: string | null } | null | undefined,
  rows: T[] | null | undefined
): { rows: T[]; missingSchema: boolean } | { failed: true } {
  if (!error) return { rows: rows ?? [], missingSchema: false }
  if (isMissingBlogSchemaError(error)) return { rows: [], missingSchema: true }
  return { failed: true }
}

function settingsValueMap(settings: readonly LegalSettingLike[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const setting of settings) {
    map[setting.option_name] = setting.option_value ?? ''
  }
  return map
}

function nonBlank(value: string | undefined): string | undefined {
  if (value == null) return undefined
  return value.trim().length > 0 ? value : undefined
}

export function legalShortcodeValue(key: string, map: Record<string, string>): string | undefined {
  if (key === 'contact_email') {
    return nonBlank(map.contact_email) ?? nonBlank(map.support_email) ?? LEGAL_VALUE_FALLBACKS.contact_email
  }
  const settingName = SHORTCODE_MAP[key]
  if (!settingName) return undefined
  const direct = nonBlank(map[settingName])
  if (direct !== undefined) return direct
  return LEGAL_VALUE_FALLBACKS[key]
}

/** Replaces known shortcodes. Blank legal values use generic phrases. Unknown tokens stay. */
export function resolveLegalShortcodes(content: string, settings: readonly LegalSettingLike[]): string {
  const map = settingsValueMap(settings)
  return content.replace(/\[([a-z_]+)\]/gi, (match, name: string) => {
    const key = name.toLowerCase()
    const settingName = SHORTCODE_MAP[key]
    if (!settingName) return match
    const value = legalShortcodeValue(key, map)
    if (value !== undefined) return value
    if (Object.prototype.hasOwnProperty.call(map, settingName)) return map[settingName] ?? ''
    return match
  })
}

export function mergeLegalSettings<T extends LegalSettingLike>(current: readonly T[], saved: readonly T[]): T[] {
  const next = [...current]
  for (const row of saved) {
    const index = next.findIndex((item) => item.option_name === row.option_name)
    if (index === -1) next.push(row)
    else next[index] = { ...next[index], ...row }
  }
  return next
}

export function renderLegalDocument(
  kind: LegalKind,
  settings: readonly LegalSettingLike[],
  draft?: string
): string {
  const stored = draft ?? settings.find((setting) => setting.option_name === legalBodyName(kind))?.option_value ?? ''
  const source = stored.trim().length > 0 ? stored : genericLegalHtml(kind)
  return resolveLegalShortcodes(source, settings)
}

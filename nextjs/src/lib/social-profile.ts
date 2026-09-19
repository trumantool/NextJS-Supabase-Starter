export const SOCIAL_PROFILE_COLUMNS = [
  'twitter_url',
  'linkedin_url',
  'github_url',
  'instagram_url',
  'youtube_url',
  'website_url',
] as const

export type SocialProfileColumn = (typeof SOCIAL_PROFILE_COLUMNS)[number]

export type SocialProfileValues = Partial<Record<SocialProfileColumn, string | null>>

export const SOCIAL_PROFILE_FIELDS: ReadonlyArray<{
  column: SocialProfileColumn
  label: string
  placeholder: string
}> = [
  { column: 'twitter_url', label: 'X (Twitter)', placeholder: 'https://x.com/username' },
  { column: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/username' },
  { column: 'github_url', label: 'GitHub', placeholder: 'https://github.com/username' },
  { column: 'instagram_url', label: 'Instagram', placeholder: 'https://www.instagram.com/username' },
  { column: 'youtube_url', label: 'YouTube', placeholder: 'https://www.youtube.com/@username' },
  { column: 'website_url', label: 'Website', placeholder: 'https://example.com' },
]

const SOCIAL_COLUMN_SET = new Set<string>(SOCIAL_PROFILE_COLUMNS)
const MAX_URL_LENGTH = 2048

export function isSocialProfileColumn(value: string): value is SocialProfileColumn {
  return SOCIAL_COLUMN_SET.has(value)
}

export function socialColumnsFromInformationSchema(
  rows: Array<{ column_name: string }>
): SocialProfileColumn[] {
  const names = new Set(rows.map((row) => row.column_name))
  return SOCIAL_PROFILE_COLUMNS.filter((column) => names.has(column))
}

/**
 * Interpret an information_schema.columns query.
 * Returns null when the query did not produce a usable schema snapshot so
 * callers can fall back to a PostgREST column probe.
 */
export function socialColumnsFromSchemaQuery(
  rows: Array<{ column_name: string }> | null | undefined,
  error?: { code?: string; message?: string } | null
): SocialProfileColumn[] | null {
  if (error || !rows || rows.length === 0) return null
  return socialColumnsFromInformationSchema(rows)
}

export function socialColumnsFromRow(
  row: Record<string, unknown> | null | undefined
): SocialProfileColumn[] {
  if (!row) return []
  return SOCIAL_PROFILE_COLUMNS.filter((column) => Object.hasOwn(row, column))
}

export function isUndefinedColumnError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true

  const message = (error.message ?? '').toLowerCase()
  if (message.includes('does not exist') && message.includes('column')) return true
  return message.includes('could not find') && message.includes('column')
}

export type UrlValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

export function validateSocialProfileUrl(
  column: SocialProfileColumn,
  raw: unknown
): UrlValidationResult {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== 'string') {
    return { ok: false, error: `${column} must be a URL` }
  }

  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: `${column} is too long` }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: `${column} must be a valid http(s) URL` }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `${column} must be a valid http(s) URL` }
  }

  return { ok: true, value: trimmed }
}

export type SocialProfileUpdateResult =
  | { ok: true; value: SocialProfileValues }
  | { ok: false; error: string }

export function buildSocialProfileUpdate(
  input: Record<string, unknown>,
  existingColumns: readonly SocialProfileColumn[]
): SocialProfileUpdateResult {
  if (existingColumns.length === 0) {
    return { ok: false, error: 'Social profile columns are not available' }
  }

  const allowed = new Set(existingColumns)
  const value: SocialProfileValues = {}

  for (const column of SOCIAL_PROFILE_COLUMNS) {
    if (!allowed.has(column) || !Object.hasOwn(input, column)) continue
    const validated = validateSocialProfileUrl(column, input[column])
    if (!validated.ok) return validated
    value[column] = validated.value
  }

  return { ok: true, value }
}

export function emptySocialProfileValues(
  columns: readonly SocialProfileColumn[]
): Record<SocialProfileColumn, string> {
  const values = {} as Record<SocialProfileColumn, string>
  for (const column of columns) {
    values[column] = ''
  }
  return values
}

export function assertProfileRowUpdated(
  row: { user_id?: string } | null | undefined
): void {
  if (!row?.user_id) {
    throw new Error('Profile not found')
  }
}

export function socialProfileValuesFromRow(
  row: Record<string, unknown> | null | undefined,
  columns: readonly SocialProfileColumn[]
): Record<SocialProfileColumn, string> {
  const values = emptySocialProfileValues(columns)
  if (!row) return values
  for (const column of columns) {
    const current = row[column]
    values[column] = typeof current === 'string' ? current : ''
  }
  return values
}

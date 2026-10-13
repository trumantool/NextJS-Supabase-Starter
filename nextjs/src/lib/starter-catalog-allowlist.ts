/**
 * Code-only catalog filter. Database templates and shared skills stay in the
 * shared project; this module hides them in the app. No SQL.
 */

export const GENERAL_BUILTIN_KEY = 'general' as const
export const TASK_MANAGEMENT_BUILTIN_KEY = 'task-management' as const
export const BUILTIN_AGENT_KEYS = [GENERAL_BUILTIN_KEY, TASK_MANAGEMENT_BUILTIN_KEY] as const

export type BuiltinAgentKey = (typeof BUILTIN_AGENT_KEYS)[number]

/** Database agent_skills.id values. Empty: the shared catalog stays hidden. */
export const ALLOWED_SHARED_SKILL_IDS: readonly string[] = []

export const HIDDEN_TEMPLATE_SLUGS = [
  'seo-agent',
  'seo-agent-copy',
  'klaviyo-agent',
  'video-gen-agent',
  'google-ads-analyst',
  'shopify-agent',
  'local-seo-agent',
  'wix-web-developer-agent',
  'meta-ads-analyst',
  'callrail-analyst',
  'paid-ads-analyst',
  'social-media-content-agent',
] as const

export const HIDDEN_TEMPLATE_IDS = [
  'ad6814e7-c3d5-403d-8f83-ba25c824194b',
  '6bf11c96-a85a-4c88-bbcf-5d364fef04fe',
  'c7e9bd02-6418-48e0-a9d4-b7c111fbc206',
  '6ea43467-ac9c-43c4-831d-af2962e5b9a8',
  '8b57e722-6e18-4862-aa5b-acf5cd39acd3',
  'a87a0010-04be-4efb-af1a-b2eec584b285',
  '0401be89-67c9-4f09-983f-305770b5a1ae',
  'a0d411a3-3bfa-413d-81c4-15fb77663a7b',
  'c4a8e1d0-6b27-4f3a-8e11-a10000000018',
  'd5b9f2e1-7c38-4a4b-9f22-b20000000027',
  'e6c0a3f2-8d49-4b5c-a033-c30000000035',
  '7280af10-981b-41c3-981b-30b462b7a568',
] as const

export const HIDDEN_TEMPLATE_NAMES = [
  'SEO Agent',
  'SEO Agent copy',
  'Klaviyo Agent',
  'Video Gen Agent',
  'Google Ads Analyst',
  'Shopify Agent',
  'Local SEO Agent',
  'Wix Web Developer Agent',
  'Meta Ads Analyst',
  'CallRail Analyst',
  'Paid Ads Analyst',
  'Flagship Social Media Content Agent',
] as const

const HIDDEN_SLUG_SET = new Set<string>(HIDDEN_TEMPLATE_SLUGS)
const HIDDEN_ID_SET = new Set<string>(HIDDEN_TEMPLATE_IDS.map((id) => id.toLowerCase()))
const HIDDEN_NAME_SET = new Set<string>(HIDDEN_TEMPLATE_NAMES)

export function isBuiltinAgentKey(value: unknown): value is BuiltinAgentKey {
  return value === GENERAL_BUILTIN_KEY || value === TASK_MANAGEMENT_BUILTIN_KEY
}

export function builtinKeyFromDefaults(defaults: unknown): BuiltinAgentKey | null {
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return null
  const key = (defaults as { builtinKey?: unknown }).builtinKey
  return isBuiltinAgentKey(key) ? key : null
}

/** True only for the code General template slug. `starter-assistant` is not special. */
export function isAllowedTemplateSlug(slug: string | null | undefined): boolean {
  return slug === GENERAL_BUILTIN_KEY
}

export function isHiddenTemplate(id: string | null | undefined, slug: string | null | undefined): boolean {
  if (slug && HIDDEN_SLUG_SET.has(slug)) return true
  if (id && HIDDEN_ID_SET.has(id.toLowerCase())) return true
  return false
}

export function isSharedSkillAllowed(id: string | null | undefined): boolean {
  if (!id) return false
  return ALLOWED_SHARED_SKILL_IDS.some((allowed) => allowed.toLowerCase() === id.toLowerCase())
}

export function isSkillRowVisible(
  row: { id: string; user_id: string | null },
  userId: string
): boolean {
  if (row.user_id === userId) return true
  if (row.user_id == null) return isSharedSkillAllowed(row.id)
  return false
}

export type UserAgentVisibilityInput = {
  source_template_id?: string | null
  source_template_name?: string | null
  defaults?: unknown
}

export function isUserAgentVisible(agent: UserAgentVisibilityInput): boolean {
  if (builtinKeyFromDefaults(agent.defaults)) return true
  if (agent.source_template_id && HIDDEN_ID_SET.has(agent.source_template_id.toLowerCase())) {
    return false
  }
  const templateId = agent.source_template_id
  const unnamed = templateId == null || templateId === ''
  if (unnamed && agent.source_template_name && HIDDEN_NAME_SET.has(agent.source_template_name)) {
    return false
  }
  return true
}

export function filterVisibleTemplates<T extends { id: string; slug: string }>(rows: T[]): T[] {
  return rows.filter((row) => isAllowedTemplateSlug(row.slug) && !isHiddenTemplate(row.id, row.slug))
}

export function filterVisibleUserAgents<T extends UserAgentVisibilityInput>(rows: T[]): T[] {
  return rows.filter((row) => isUserAgentVisible(row))
}

export function skillAttachmentError(
  userId: string,
  skillIds: string[],
  rows: Array<{ id: string; user_id: string | null }>
): string | null {
  if (skillIds.length === 0) return null
  const byId = new Map(rows.map((row) => [String(row.id).toLowerCase(), row]))
  for (const id of skillIds) {
    const row = byId.get(id.toLowerCase())
    if (!row || !isSkillRowVisible(row, userId)) {
      return 'Shared catalog skills cannot be attached. Upload a skill and attach that one.'
    }
  }
  return null
}

/** Any template_id or starter flag is a clone attempt. Builtin ensure uses `builtin`, not `template_id`. */
export function isRejectedTemplateClone(body: {
  starter?: unknown
  template_id?: unknown
}): boolean {
  if (body.starter === true) return true
  return typeof body.template_id === 'string' && body.template_id.trim().length > 0
}

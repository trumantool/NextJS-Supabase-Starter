import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/ids'
import type { AgentTemplate } from '@/lib/types'

export const MAX_TEMPLATE_SKILLS = 8
export const MAX_NAME_LENGTH = 80
export const MAX_SLUG_LENGTH = 64
export const MAX_PROMPT_LENGTH = 8000
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_AGENTS_PER_USER = 40
export const MAX_MODEL_ID_LENGTH = 200

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Same default as Documents / chats. OpenRouter model slugs, not a hard allowlist. */
export const DEFAULT_AGENT_MODEL = 'poolside/laguna-s-2.1:free'

export const STARTER_TEMPLATE_SLUG = 'starter-assistant'

export type TemplateStatus = 'draft' | 'published'

export type AgentDefaultsV1 = {
  model_id?: string
  [key: string]: unknown
}

export type CatalogTemplate = AgentTemplate & { builtin?: boolean }

/**
 * The one generic recipe this starter ships. Not SEO/Ads-specific.
 * Shown in the gallery until an admin publishes a matching row.
 */
export const STARTER_TEMPLATE: Omit<
  AgentTemplate,
  'id' | 'created_by' | 'cloned_from_template_id' | 'created_at' | 'updated_at'
> & { id: typeof STARTER_TEMPLATE_SLUG } = {
  id: STARTER_TEMPLATE_SLUG,
  name: 'Starter Assistant',
  slug: STARTER_TEMPLATE_SLUG,
  description:
    'A general-purpose assistant. Clone it, then attach skills to specialize. Chat uses this recipe in Phase 5.',
  status: 'published',
  system_prompt:
    'You are a helpful workspace assistant. Follow any attached skills as instructions. Be concise, accurate, and ask a clarifying question when the request is ambiguous.',
  skill_ids: [],
  required_toolkits: [],
  mcp_config: {},
  memory_config: {},
  defaults: { model_id: DEFAULT_AGENT_MODEL },
}

export function isModelId(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const model = value.trim()
  if (model.length < 1 || model.length > MAX_MODEL_ID_LENGTH) return false
  if (/\s/.test(model)) return false
  return true
}

export function parseModelId(value: unknown): { error?: string; model_id?: string } {
  if (value === undefined || value === null || value === '') {
    return { model_id: DEFAULT_AGENT_MODEL }
  }
  if (!isModelId(value)) {
    return { error: 'model_id must be a non-empty OpenRouter model id (no spaces).' }
  }
  return { model_id: value.trim() }
}

export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
  return slug.length >= 2 ? slug : 'template'
}

export function parseSlug(value: unknown): { error?: string; slug?: string } {
  if (typeof value !== 'string') {
    return { error: 'Slug is required (2–64 characters, lowercase kebab-case).' }
  }
  const slug = value.trim().toLowerCase()
  if (slug.length < 2 || slug.length > MAX_SLUG_LENGTH || !SLUG_RE.test(slug)) {
    return { error: 'Slug must be 2–64 characters of lowercase letters, numbers, and hyphens.' }
  }
  return { slug }
}

export function parseTemplateName(value: unknown): { error?: string; name?: string } {
  if (typeof value !== 'string') {
    return { error: 'Name is required (1–80 characters).' }
  }
  const name = value.trim()
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return { error: 'Name is required (1–80 characters).' }
  }
  return { name }
}

export function parseDescription(value: unknown): { error?: string; description?: string | null } {
  if (value === undefined || value === null || value === '') {
    return { description: null }
  }
  if (typeof value !== 'string') {
    return { error: 'Description must be a string.' }
  }
  const description = value.trim()
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.` }
  }
  return { description: description || null }
}

export function parseSystemPrompt(value: unknown): { error?: string; system_prompt?: string } {
  if (value === undefined || value === null) {
    return { system_prompt: '' }
  }
  if (typeof value !== 'string') {
    return { error: 'System prompt must be a string.' }
  }
  if (value.length > MAX_PROMPT_LENGTH) {
    return { error: `System prompt must be at most ${MAX_PROMPT_LENGTH} characters.` }
  }
  return { system_prompt: value }
}

export function parseStatus(value: unknown): { error?: string; status?: TemplateStatus } {
  if (value === undefined || value === null) {
    return { status: 'draft' }
  }
  if (value !== 'draft' && value !== 'published') {
    return { error: 'Status must be draft or published.' }
  }
  return { status: value }
}

export function parseDefaults(value: unknown): { error?: string; defaults?: AgentDefaultsV1 } {
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0)
  ) {
    return { defaults: { model_id: DEFAULT_AGENT_MODEL } }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'defaults must be an object.' }
  }
  const raw = { ...(value as Record<string, unknown>) }
  if (raw.model_id !== undefined) {
    const parsed = parseModelId(raw.model_id)
    if (parsed.error || !parsed.model_id) {
      return { error: parsed.error || 'Invalid model_id.' }
    }
    raw.model_id = parsed.model_id
  } else {
    raw.model_id = DEFAULT_AGENT_MODEL
  }
  return { defaults: raw as AgentDefaultsV1 }
}

export function parseTemplateSkillIds(value: unknown): { error?: string; ids?: string[] } {
  if (value === undefined || value === null) {
    return { ids: [] }
  }
  if (!Array.isArray(value)) {
    return { error: 'skill_ids must be an array of UUIDs.' }
  }
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!isUuid(item)) {
      return { error: 'Each skill_id must be a UUID.' }
    }
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    ids.push(item)
  }
  if (ids.length > MAX_TEMPLATE_SKILLS) {
    return { error: `Select at most ${MAX_TEMPLATE_SKILLS} skills.` }
  }
  return { ids }
}

export function modelIdFromDefaults(defaults: unknown): string {
  if (defaults && typeof defaults === 'object' && !Array.isArray(defaults)) {
    const model = (defaults as AgentDefaultsV1).model_id
    if (typeof model === 'string' && model.trim()) return model.trim()
  }
  return DEFAULT_AGENT_MODEL
}

export function sharedSkillIdsError(
  skillIds: string[],
  rows: Array<{ id: string; user_id: string | null }>
): string | null {
  if (skillIds.length === 0) return null
  const byId = new Map(rows.map((row) => [String(row.id).toLowerCase(), row]))
  for (const id of skillIds) {
    const row = byId.get(id.toLowerCase())
    if (!row) {
      return 'One or more skills are missing or not readable. Templates may only use shared skills.'
    }
    if (row.user_id !== null) {
      return 'Templates may only use shared skills. Remove personal skills from this catalog recipe.'
    }
  }
  return null
}

export async function assertSharedSkillIds(
  supabase: SupabaseClient,
  skillIds: string[]
): Promise<string | null> {
  if (skillIds.length === 0) return null
  const { data, error } = await supabase
    .from('agent_skills')
    .select('id, user_id')
    .in('id', skillIds)
  if (error) {
    console.error('assertSharedSkillIds:', error)
    return 'Failed to validate skills.'
  }
  return sharedSkillIdsError(skillIds, data || [])
}

export async function assertSkillIdsVisible(
  supabase: SupabaseClient,
  userId: string,
  skillIds: string[]
): Promise<string | null> {
  if (skillIds.length === 0) return null
  const { data, error } = await supabase
    .from('agent_skills')
    .select('id, user_id')
    .in('id', skillIds)
  if (error) {
    console.error('assertSkillIdsVisible:', error)
    return 'Failed to validate skills.'
  }
  const byId = new Map((data || []).map((row) => [String(row.id).toLowerCase(), row]))
  for (const id of skillIds) {
    const row = byId.get(id.toLowerCase())
    if (!row) {
      return 'One or more skills are missing or not readable.'
    }
    if (row.user_id !== null && row.user_id !== userId) {
      return 'You can only attach your own skills or shared skills.'
    }
  }
  return null
}

export async function isAdminUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.user_role === 'admin'
}

export function publishRecipeError(input: {
  name: string
  slug: string
  system_prompt: string
  skill_ids: string[]
}): string | null {
  if (!input.name.trim() || !input.slug.trim()) {
    return 'Published templates need a name and slug.'
  }
  if (input.system_prompt.trim().length < 1 && input.skill_ids.length < 1) {
    return 'Published templates need a system prompt or at least one shared skill.'
  }
  return null
}

/** Inject the built-in starter when the catalog has no matching slug. */
export function withBuiltinStarter(templates: AgentTemplate[]): CatalogTemplate[] {
  const hasStarter = templates.some((t) => t.slug === STARTER_TEMPLATE_SLUG)
  if (hasStarter) return templates
  const now = new Date(0).toISOString()
  const builtin: CatalogTemplate = {
    ...STARTER_TEMPLATE,
    created_by: '',
    cloned_from_template_id: null,
    created_at: now,
    updated_at: now,
    builtin: true,
  }
  return [builtin, ...templates]
}

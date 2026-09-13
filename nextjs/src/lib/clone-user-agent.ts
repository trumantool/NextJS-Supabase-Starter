import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/ids'
import {
  assertSkillIdsVisible,
  STARTER_TEMPLATE,
  STARTER_TEMPLATE_SLUG,
} from '@/lib/agent-templates'
import {
  assertAgentCap,
  attachAgentMemory,
  blankAgentRecipe,
  buildUserAgentSnapshot,
  parseAgentName,
  parseCloneAgentOverrides,
} from '@/lib/user-agents'
import type { AgentTemplate, UserAgent } from '@/lib/types'

export type CloneTemplateResult =
  | { ok: true; agent: UserAgent }
  | { ok: false; error: string; status: number }

export async function cloneTemplateToUserAgent(
  supabase: SupabaseClient,
  opts: {
    userId: string
    templateId: string
    name: unknown
    allowUnpublished?: boolean
    system_prompt?: unknown
    skill_ids?: unknown
    defaults?: unknown
    model_id?: unknown
  }
): Promise<CloneTemplateResult> {
  const named = parseAgentName(opts.name)
  if (named.error || !named.name) {
    return { ok: false, error: named.error || 'Invalid name.', status: 400 }
  }

  const parsedOverrides = parseCloneAgentOverrides({
    system_prompt: opts.system_prompt,
    skill_ids: opts.skill_ids,
    defaults: opts.defaults,
    model_id: opts.model_id,
  })
  if (parsedOverrides.error) {
    return { ok: false, error: parsedOverrides.error, status: 400 }
  }

  const cap = await assertAgentCap(supabase, opts.userId)
  if (cap) {
    return { ok: false, error: cap, status: cap === 'Failed to create agent' ? 500 : 400 }
  }

  const template = await loadCloneSource(supabase, opts.templateId, opts.allowUnpublished)
  if (!template) {
    return { ok: false, error: 'Template not found', status: 404 }
  }

  if (parsedOverrides.overrides?.skill_ids) {
    const visible = await assertSkillIdsVisible(
      supabase,
      opts.userId,
      parsedOverrides.overrides.skill_ids
    )
    if (visible) {
      return { ok: false, error: visible, status: 400 }
    }
  }

  const snapshot = buildUserAgentSnapshot(template, named.name, parsedOverrides.overrides)
  const { data: agent, error } = await supabase
    .from('user_agents')
    .insert({
      user_id: opts.userId,
      ...snapshot,
    })
    .select('*')
    .single()

  if (error || !agent) {
    console.error('Failed to create user agent:', error)
    return { ok: false, error: 'Failed to create agent', status: 500 }
  }

  return { ok: true, agent: await attachAgentMemory(supabase, opts.userId, agent) }
}

export async function createBlankUserAgent(
  supabase: SupabaseClient,
  opts: {
    userId: string
    name: unknown
    system_prompt?: unknown
    skill_ids?: unknown
    defaults?: unknown
    model_id?: unknown
  }
): Promise<CloneTemplateResult> {
  const named = parseAgentName(opts.name)
  if (named.error || !named.name) {
    return { ok: false, error: named.error || 'Invalid name.', status: 400 }
  }

  const parsedOverrides = parseCloneAgentOverrides({
    system_prompt: opts.system_prompt,
    skill_ids: opts.skill_ids,
    defaults: opts.defaults,
    model_id: opts.model_id,
  })
  if (parsedOverrides.error) {
    return { ok: false, error: parsedOverrides.error, status: 400 }
  }

  const cap = await assertAgentCap(supabase, opts.userId)
  if (cap) {
    return { ok: false, error: cap, status: cap === 'Failed to create agent' ? 500 : 400 }
  }

  if (parsedOverrides.overrides?.skill_ids) {
    const visible = await assertSkillIdsVisible(
      supabase,
      opts.userId,
      parsedOverrides.overrides.skill_ids
    )
    if (visible) {
      return { ok: false, error: visible, status: 400 }
    }
  }

  const snapshot = buildUserAgentSnapshot(
    blankAgentRecipe(),
    named.name,
    parsedOverrides.overrides
  )
  snapshot.source_template_name = ''

  const { data: agent, error } = await supabase
    .from('user_agents')
    .insert({
      user_id: opts.userId,
      ...snapshot,
    })
    .select('*')
    .single()

  if (error || !agent) {
    console.error('Failed to create user agent:', error)
    return { ok: false, error: 'Failed to create agent', status: 500 }
  }

  return { ok: true, agent: await attachAgentMemory(supabase, opts.userId, agent) }
}

async function loadCloneSource(
  supabase: SupabaseClient,
  templateId: string,
  allowUnpublished?: boolean
): Promise<AgentTemplate | typeof STARTER_TEMPLATE | null> {
  if (templateId === STARTER_TEMPLATE_SLUG || templateId === STARTER_TEMPLATE.id) {
    const { data } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('slug', STARTER_TEMPLATE_SLUG)
      .maybeSingle()
    if (data && (data.status === 'published' || allowUnpublished)) {
      return data
    }
    return STARTER_TEMPLATE
  }

  if (!isUuid(templateId)) return null

  const { data, error } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load template for clone:', error)
    return null
  }
  if (!data || (data.status !== 'published' && !allowUnpublished)) {
    return null
  }
  return data
}

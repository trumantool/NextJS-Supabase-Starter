import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSkillIdsVisible } from '@/lib/agent-templates'
import {
  assertAgentCap,
  attachAgentMemory,
  blankAgentRecipe,
  buildUserAgentSnapshot,
  parseAgentName,
  parseCloneAgentOverrides,
} from '@/lib/user-agents'
import type { UserAgent } from '@/lib/types'

export type CloneTemplateResult =
  | { ok: true; agent: UserAgent }
  | { ok: false; error: string; status: number }

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

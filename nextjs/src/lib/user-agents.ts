import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_AGENT_MODEL,
  MAX_AGENTS_PER_USER,
  MAX_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  parseDefaults,
  parseModelId,
  parseTemplateSkillIds,
  STARTER_TEMPLATE,
  type AgentDefaultsV1,
} from '@/lib/agent-templates'
import { defaultMemoryConfig, ensureAgentMemoryFolder } from '@/lib/agent-memory'
import { isUuid } from '@/lib/ids'
import type { AgentTemplate, Json, UserAgent } from '@/lib/types'

export { MAX_AGENTS_PER_USER }

export function parseAgentName(value: unknown): { error?: string; name?: string } {
  if (typeof value !== 'string') {
    return { error: 'Name is required (1–80 characters).' }
  }
  const name = value.trim()
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return { error: 'Name is required (1–80 characters).' }
  }
  return { name }
}

export function parseUserAgentPrompt(value: unknown): { error?: string; system_prompt?: string } {
  if (typeof value !== 'string') {
    return { error: 'System prompt must be a string.' }
  }
  if (value.length > MAX_PROMPT_LENGTH) {
    return { error: `System prompt must be at most ${MAX_PROMPT_LENGTH} characters.` }
  }
  return { system_prompt: value }
}

export function parseUserAgentSkillIds(value: unknown): { error?: string; ids?: string[] } {
  return parseTemplateSkillIds(value)
}

export function parseUserAgentDefaults(value: unknown): { error?: string; defaults?: AgentDefaultsV1 } {
  return parseDefaults(value)
}

export type CloneAgentOverrides = {
  system_prompt?: string
  skill_ids?: string[]
  defaults?: AgentDefaultsV1
}

export function parseCloneAgentOverrides(body: {
  system_prompt?: unknown
  skill_ids?: unknown
  defaults?: unknown
  model_id?: unknown
}): { error?: string; overrides?: CloneAgentOverrides } {
  const overrides: CloneAgentOverrides = {}

  if (body.system_prompt !== undefined) {
    const prompt = parseUserAgentPrompt(body.system_prompt)
    if (prompt.error || prompt.system_prompt === undefined) {
      return { error: prompt.error || 'Invalid system prompt.' }
    }
    overrides.system_prompt = prompt.system_prompt
  }

  if (body.skill_ids !== undefined) {
    const skills = parseUserAgentSkillIds(body.skill_ids)
    if (skills.error || !skills.ids) {
      return { error: skills.error || 'Invalid skill ids.' }
    }
    overrides.skill_ids = skills.ids
  }

  if (body.defaults !== undefined || body.model_id !== undefined) {
    const base =
      body.defaults && typeof body.defaults === 'object' && !Array.isArray(body.defaults)
        ? { ...(body.defaults as AgentDefaultsV1) }
        : {}
    if (body.model_id !== undefined) {
      const parsed = parseModelId(body.model_id)
      if (parsed.error || !parsed.model_id) {
        return { error: parsed.error || 'Invalid model_id.' }
      }
      base.model_id = parsed.model_id
    }
    const defaults = parseUserAgentDefaults(base)
    if (defaults.error || !defaults.defaults) {
      return { error: defaults.error || 'Invalid defaults.' }
    }
    overrides.defaults = defaults.defaults
  }

  return { overrides }
}

export function buildUserAgentSnapshot(
  template: Pick<
    AgentTemplate,
    | 'id'
    | 'name'
    | 'system_prompt'
    | 'skill_ids'
    | 'required_toolkits'
    | 'mcp_config'
    | 'memory_config'
    | 'defaults'
  >,
  name: string,
  overrides?: CloneAgentOverrides
): Pick<
  UserAgent,
  | 'name'
  | 'source_template_id'
  | 'source_template_name'
  | 'system_prompt'
  | 'skill_ids'
  | 'required_toolkits'
  | 'mcp_config'
  | 'memory_config'
  | 'defaults'
> {
  const templateDefaults =
    template.defaults && typeof template.defaults === 'object' && !Array.isArray(template.defaults)
      ? { ...(template.defaults as AgentDefaultsV1) }
      : { model_id: DEFAULT_AGENT_MODEL }

  const sourceId = isUuid(template.id) ? template.id : null

  return {
    name,
    source_template_id: sourceId,
    source_template_name: template.name,
    system_prompt:
      overrides?.system_prompt !== undefined ? overrides.system_prompt : template.system_prompt,
    skill_ids:
      overrides?.skill_ids !== undefined
        ? [...overrides.skill_ids]
        : Array.isArray(template.skill_ids)
          ? [...template.skill_ids]
          : [],
    required_toolkits: [],
    mcp_config: {},
    memory_config: template.memory_config ?? {},
    defaults: (overrides?.defaults
      ? { ...templateDefaults, ...overrides.defaults }
      : templateDefaults) as Json,
  }
}

export function perUserAgentCapError(count: number): string | null {
  if (count >= MAX_AGENTS_PER_USER) {
    return `You can have at most ${MAX_AGENTS_PER_USER} agents.`
  }
  return null
}

export async function assertAgentCap(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { count, error } = await supabase
    .from('user_agents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.error('Failed to count user agents:', error)
    return 'Failed to create agent'
  }
  return perUserAgentCapError(count ?? 0)
}

export async function attachAgentMemory(
  supabase: SupabaseClient,
  userId: string,
  agent: UserAgent
): Promise<UserAgent> {
  try {
    const prefix = await ensureAgentMemoryFolder({
      supabase,
      userId,
      agentId: agent.id,
    })
    const next = {
      ...defaultMemoryConfig(userId, agent.id),
      resolved_prefix: prefix,
    }
    const { data } = await supabase
      .from('user_agents')
      .update({ memory_config: next as Json })
      .eq('id', agent.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    return data || agent
  } catch (err) {
    console.error('attachAgentMemory:', err)
    return agent
  }
}

export function blankAgentRecipe(): Parameters<typeof buildUserAgentSnapshot>[0] {
  return {
    id: '',
    name: 'Custom',
    system_prompt: '',
    skill_ids: [],
    required_toolkits: [],
    mcp_config: {},
    memory_config: {},
    defaults: { model_id: DEFAULT_AGENT_MODEL },
  }
}

export { STARTER_TEMPLATE }

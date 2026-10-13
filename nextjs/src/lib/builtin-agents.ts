import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_AGENT_MODEL } from '@/lib/agent-templates'
import { createBlankUserAgent, type CloneTemplateResult } from '@/lib/clone-user-agent'
import {
  GENERAL_BUILTIN_KEY,
  TASK_MANAGEMENT_BUILTIN_KEY,
  builtinKeyFromDefaults,
  isBuiltinAgentKey,
  type BuiltinAgentKey,
} from '@/lib/starter-catalog-allowlist'
import type { AgentDefaultsV1 } from '@/lib/agent-templates'
import type { UserAgent } from '@/lib/types'

export type BuiltinSkillDescriptor = {
  slug: string
  name: string
  description: string
}

export type BuiltinAgentSpec = {
  key: BuiltinAgentKey
  name: string
  switcherLabel: string
  systemPrompt: string
}

export const GENERAL_AGENT: BuiltinAgentSpec = {
  key: GENERAL_BUILTIN_KEY,
  name: 'General',
  switcherLabel: 'General agent',
  systemPrompt:
    'You are a helpful workspace assistant. Be concise, accurate, and ask a clarifying question when the request is ambiguous. Follow any attached personal skills as instructions.',
}

export const TASK_MANAGEMENT_AGENT: BuiltinAgentSpec = {
  key: TASK_MANAGEMENT_BUILTIN_KEY,
  name: 'Task Management',
  switcherLabel: 'Task Management',
  systemPrompt:
    'You are a task management assistant for the signed-in user. Use the task tools to list, create, complete, and delete only that user\'s to-do rows. Do not invent categories, assignees, or a platform-agent column. Follow the built-in task skills, then any personal skills attached to this agent.',
}

const BY_KEY: Record<BuiltinAgentKey, BuiltinAgentSpec> = {
  [GENERAL_BUILTIN_KEY]: GENERAL_AGENT,
  [TASK_MANAGEMENT_BUILTIN_KEY]: TASK_MANAGEMENT_AGENT,
}

export const TASK_MANAGEMENT_SKILLS: readonly BuiltinSkillDescriptor[] = [
  {
    slug: 'list-tasks',
    name: 'List tasks',
    description: 'List the signed-in owner\'s to-do rows.',
  },
  {
    slug: 'create-task',
    name: 'Create task',
    description: 'Create a to-do with a title and optional description or urgent flag.',
  },
  {
    slug: 'complete-task',
    name: 'Complete task',
    description: 'Mark one owned to-do done. There is no reopen.',
  },
  {
    slug: 'delete-task',
    name: 'Delete task',
    description: 'Delete one owned to-do by id.',
  },
]

export function builtinAgentByKey(key: BuiltinAgentKey): BuiltinAgentSpec {
  return BY_KEY[key]
}

export function listBuiltinSkills(): readonly BuiltinSkillDescriptor[] {
  return TASK_MANAGEMENT_SKILLS
}

export function builtinSkillBySlug(slug: string): BuiltinSkillDescriptor | null {
  return TASK_MANAGEMENT_SKILLS.find((skill) => skill.slug === slug) ?? null
}

/** Keep a row's builtinKey. Clients cannot set or clear it through PATCH. */
export function defaultsKeepingBuiltinKey(current: unknown, next: AgentDefaultsV1): AgentDefaultsV1 {
  const key = builtinKeyFromDefaults(current)
  const merged: AgentDefaultsV1 = { ...next }
  if (key) {
    merged.builtinKey = key
  } else if ('builtinKey' in merged) {
    delete merged.builtinKey
  }
  return merged
}

/**
 * One user_agents row per user per builtin key. Inserts only when that user
 * selects the agent and no matching row exists yet.
 */
export async function ensureBuiltinUserAgent(
  supabase: SupabaseClient,
  userId: string,
  key: BuiltinAgentKey
): Promise<CloneTemplateResult> {
  const spec = builtinAgentByKey(key)
  const { data, error } = await supabase
    .from('user_agents')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('ensureBuiltinUserAgent:', error)
    return { ok: false, error: 'Failed to load agents', status: 500 }
  }

  const existing = (data || []).find((row) => builtinKeyFromDefaults(row.defaults) === key)
  if (existing) {
    return { ok: true, agent: existing as UserAgent }
  }

  return createBlankUserAgent(supabase, {
    userId,
    name: spec.name,
    system_prompt: spec.systemPrompt,
    skill_ids: [],
    defaults: {
      builtinKey: key,
      model_id: DEFAULT_AGENT_MODEL,
    },
  })
}

export function parseBuiltinSelection(value: unknown): BuiltinAgentKey | null {
  return isBuiltinAgentKey(value) ? value : null
}

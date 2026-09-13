import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseModelId,
  parseTemplateSkillIds,
  DEFAULT_AGENT_MODEL,
} from '@/lib/agent-templates'
import type { AutomationFrequency, ScheduleInput } from '@/lib/automation-schedule'
import {
  assertValidTimeZone,
  computeNextRunAt,
  normalizeLocalTime,
} from '@/lib/automation-schedule'
import { isUuid } from '@/lib/ids'
import { assertSkillIdsVisible } from '@/lib/load-agent-skills'

export const MAX_AUTOMATIONS_PER_USER = 20
export const MAX_NAME_LENGTH = 80
export const MAX_PROMPT_LENGTH = 8000

const FREQUENCIES: AutomationFrequency[] = [
  'once',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
]

export type AutomationWriteInput = {
  name: string
  prompt: string
  frequency: AutomationFrequency
  timezone: string
  localTime: string
  weekday: number | null
  monthday: number | null
  month: number | null
  onceOn: string | null
  allowMutations: boolean
  modelId: string
  skillIds: string[]
  agentId: string | null
}

export type ParsedAutomationBody = {
  name?: string
  prompt?: string
  frequency?: AutomationFrequency
  timezone?: string
  localTime?: string
  weekday?: number | null
  monthday?: number | null
  month?: number | null
  onceOn?: string | null
  allowMutations?: boolean
  modelId?: string
  skillIds?: string[]
  skillIdsError?: string
  agentId?: string | null
  agentIdError?: string
  status?: 'active' | 'paused'
}

export function parseAutomationBody(body: unknown): ParsedAutomationBody {
  const raw = (body ?? {}) as Record<string, unknown>
  const out: ParsedAutomationBody = {}

  if (typeof raw.name === 'string') out.name = raw.name
  if (typeof raw.prompt === 'string') out.prompt = raw.prompt
  if (typeof raw.frequency === 'string' && FREQUENCIES.includes(raw.frequency as AutomationFrequency)) {
    out.frequency = raw.frequency as AutomationFrequency
  }
  if (typeof raw.timezone === 'string') out.timezone = raw.timezone
  if (typeof raw.local_time === 'string') out.localTime = raw.local_time
  if (typeof raw.localTime === 'string') out.localTime = raw.localTime
  if (raw.weekday === null) out.weekday = null
  if (typeof raw.weekday === 'number') out.weekday = raw.weekday
  if (raw.monthday === null) out.monthday = null
  if (typeof raw.monthday === 'number') out.monthday = raw.monthday
  if (raw.month === null) out.month = null
  if (typeof raw.month === 'number') out.month = raw.month
  if (raw.once_on === null || raw.onceOn === null) out.onceOn = null
  if (typeof raw.once_on === 'string') out.onceOn = raw.once_on
  if (typeof raw.onceOn === 'string') out.onceOn = raw.onceOn
  if (typeof raw.allow_mutations === 'boolean') out.allowMutations = raw.allow_mutations
  if (typeof raw.allowMutations === 'boolean') out.allowMutations = raw.allowMutations
  if (typeof raw.model_id === 'string') out.modelId = raw.model_id
  if (typeof raw.modelId === 'string') out.modelId = raw.modelId
  if (raw.status === 'active' || raw.status === 'paused') out.status = raw.status
  if ('skill_ids' in raw || 'skillIds' in raw) {
    const parsedIds = parseTemplateSkillIds(raw.skill_ids ?? raw.skillIds)
    if (parsedIds.error) {
      out.skillIdsError = parsedIds.error
    } else if (parsedIds.ids) {
      out.skillIds = parsedIds.ids
    } else {
      out.skillIdsError = 'skill_ids must be an array of skill ids.'
    }
  }
  if ('agent_id' in raw || 'agentId' in raw) {
    const parsedAgent = parseOptionalAgentId(raw.agent_id ?? raw.agentId)
    if (parsedAgent.error) {
      out.agentIdError = parsedAgent.error
    } else {
      out.agentId = parsedAgent.agentId ?? null
    }
  }
  return out
}

export function parseOptionalAgentId(value: unknown): {
  error?: string
  agentId?: string | null
} {
  if (value === undefined) return {}
  if (value === null || value === '') return { agentId: null }
  if (!isUuid(value)) {
    return { error: 'agent_id must be a UUID or null.' }
  }
  return { agentId: value }
}

export function validateCreateInput(parsed: ParsedAutomationBody): {
  error?: string
  value?: AutomationWriteInput
} {
  const name = (parsed.name ?? '').trim()
  const prompt = (parsed.prompt ?? '').trim()
  if (!name || name.length > MAX_NAME_LENGTH) {
    return { error: `Name is required (1–${MAX_NAME_LENGTH} characters).` }
  }
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return { error: `Instructions are required (1–${MAX_PROMPT_LENGTH} characters).` }
  }
  if (!parsed.frequency) {
    return { error: 'Frequency is required.' }
  }
  if (!parsed.timezone) {
    return { error: 'Timezone is required.' }
  }
  try {
    assertValidTimeZone(parsed.timezone)
  } catch {
    return { error: 'Invalid timezone.' }
  }
  if (!parsed.localTime) {
    return { error: 'Time is required.' }
  }
  let localTime: string
  try {
    localTime = normalizeLocalTime(parsed.localTime)
  } catch {
    return { error: 'Invalid time.' }
  }

  const scheduleError = validateScheduleFields({
    frequency: parsed.frequency,
    weekday: parsed.weekday ?? null,
    monthday: parsed.monthday ?? null,
    month: parsed.month ?? null,
    onceOn: parsed.onceOn ?? null,
  })
  if (scheduleError) return { error: scheduleError }

  if (parsed.skillIdsError) {
    return { error: parsed.skillIdsError }
  }
  if (parsed.agentIdError) {
    return { error: parsed.agentIdError }
  }

  const model = parseModelId(parsed.modelId ?? DEFAULT_AGENT_MODEL)
  if (model.error || !model.model_id) {
    return { error: model.error || 'Invalid model.' }
  }

  return {
    value: {
      name,
      prompt,
      frequency: parsed.frequency,
      timezone: parsed.timezone,
      localTime,
      weekday: parsed.weekday ?? null,
      monthday: parsed.monthday ?? null,
      month: parsed.month ?? null,
      onceOn: parsed.onceOn ?? null,
      allowMutations: parsed.allowMutations ?? false,
      modelId: model.model_id,
      skillIds: parsed.skillIds ?? [],
      agentId: parsed.agentId ?? null,
    },
  }
}

export function validateScheduleFields(fields: {
  frequency: AutomationFrequency
  weekday: number | null
  monthday: number | null
  month: number | null
  onceOn: string | null
}): string | null {
  if (fields.frequency === 'weekly') {
    if (fields.weekday == null || fields.weekday < 0 || fields.weekday > 6) {
      return 'Weekly schedules require a weekday (Monday = 0).'
    }
  }
  if (fields.frequency === 'monthly') {
    if (fields.monthday == null || fields.monthday < 1 || fields.monthday > 31) {
      return 'Monthly schedules require a day of month (1–31).'
    }
  }
  if (fields.frequency === 'yearly') {
    if (fields.month == null || fields.month < 1 || fields.month > 12) {
      return 'Yearly schedules require a month (1–12).'
    }
    if (fields.monthday == null || fields.monthday < 1 || fields.monthday > 31) {
      return 'Yearly schedules require a day of month (1–31).'
    }
  }
  if (fields.frequency === 'once') {
    if (!fields.onceOn || !/^\d{4}-\d{2}-\d{2}$/.test(fields.onceOn)) {
      return 'One-time schedules require a date.'
    }
  }
  return null
}

export async function assertAgentOwned(
  supabase: SupabaseClient,
  userId: string,
  agentId: string | null
): Promise<string | null> {
  if (!agentId) return null
  const { data, error } = await supabase
    .from('user_agents')
    .select('id')
    .eq('id', agentId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return 'Failed to validate agent.'
  if (!data) return 'Agent not found.'
  return null
}

export { assertSkillIdsVisible }

export function toScheduleInput(value: {
  frequency: AutomationFrequency
  timezone: string
  localTime: string
  weekday: number | null
  monthday: number | null
  month: number | null
  onceOn: string | null
}): ScheduleInput {
  return {
    frequency: value.frequency,
    timezone: value.timezone,
    localTime: value.localTime,
    weekday: value.weekday ?? undefined,
    monthday: value.monthday ?? undefined,
    month: value.month ?? undefined,
    onceOn: value.onceOn ?? undefined,
  }
}

export function computeCreateNextRunAt(value: AutomationWriteInput): {
  error?: string
  nextRunAt?: string | null
} {
  try {
    const next = computeNextRunAt(toScheduleInput(value), new Date())
    if (value.frequency === 'once' && !next) {
      return { error: 'The one-time run must be in the future.' }
    }
    return { nextRunAt: next ? next.toISOString() : null }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Invalid schedule.',
    }
  }
}

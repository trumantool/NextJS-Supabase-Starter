import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { parseModelId } from '@/lib/agent-templates'
import {
  assertAgentOwned,
  assertSkillIdsVisible,
  parseAutomationBody,
  toScheduleInput,
  validateScheduleFields,
} from '@/lib/automations'
import {
  computeNextRunAt,
  formatCadence,
  normalizeLocalTime,
  scheduleFromAutomation,
  type AutomationFrequency,
} from '@/lib/automation-schedule'
import type { TablesUpdate } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

function withCadence<T extends Parameters<typeof scheduleFromAutomation>[0]>(row: T) {
  return {
    ...row,
    cadence: formatCadence(scheduleFromAutomation(row)),
  }
}

/**
 * GET /api/automations/[id]
 * Detail plus the 50 most recent runs (including output).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch automation:', error)
      return NextResponse.json({ error: 'Failed to fetch automation' }, { status: 500 })
    }
    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const { data: runs, error: runError } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (runError) {
      console.error('Failed to fetch runs:', runError)
      return NextResponse.json({ error: 'Failed to fetch automation' }, { status: 500 })
    }

    return NextResponse.json({
      automation: withCadence(automation),
      runs: runs || [],
    })
  } catch (err) {
    console.error('Automation GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/automations/[id]
 * Update fields; recompute next_run_at when schedule or status changes.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existing, error: findError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find automation:', findError)
      return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const parsed = parseAutomationBody(await request.json().catch(() => ({})))
    const patch: TablesUpdate<'automations'> = {}

    if (parsed.name !== undefined) {
      const name = parsed.name.trim()
      if (!name || name.length > 80) {
        return NextResponse.json({ error: 'Name is required (1–80 characters).' }, { status: 400 })
      }
      patch.name = name
    }
    if (parsed.prompt !== undefined) {
      const prompt = parsed.prompt.trim()
      if (!prompt || prompt.length > 8000) {
        return NextResponse.json(
          { error: 'Instructions are required (1–8000 characters).' },
          { status: 400 }
        )
      }
      patch.prompt = prompt
    }
    if (parsed.allowMutations !== undefined) {
      patch.allow_mutations = parsed.allowMutations
    }
    if (parsed.modelId !== undefined) {
      const model = parseModelId(parsed.modelId)
      if (model.error || !model.model_id) {
        return NextResponse.json({ error: model.error || 'Invalid model.' }, { status: 400 })
      }
      patch.model_id = model.model_id
    }
    if (parsed.skillIdsError) {
      return NextResponse.json({ error: parsed.skillIdsError }, { status: 400 })
    }
    if (parsed.skillIds !== undefined) {
      const skillsOk = await assertSkillIdsVisible(supabase, user.id, parsed.skillIds)
      if (skillsOk) {
        return NextResponse.json({ error: skillsOk }, { status: 400 })
      }
      patch.skill_ids = parsed.skillIds
    }
    if (parsed.agentIdError) {
      return NextResponse.json({ error: parsed.agentIdError }, { status: 400 })
    }
    if (parsed.agentId !== undefined) {
      const agentOk = await assertAgentOwned(supabase, user.id, parsed.agentId)
      if (agentOk) {
        return NextResponse.json({ error: agentOk }, { status: 400 })
      }
      patch.agent_id = parsed.agentId
    }

    const scheduleTouched =
      parsed.frequency !== undefined ||
      parsed.timezone !== undefined ||
      parsed.localTime !== undefined ||
      parsed.weekday !== undefined ||
      parsed.monthday !== undefined ||
      parsed.month !== undefined ||
      parsed.onceOn !== undefined

    const frequency = (parsed.frequency ?? existing.frequency) as AutomationFrequency
    const timezone = parsed.timezone ?? existing.timezone
    let localTime = existing.local_time
    if (parsed.localTime !== undefined) {
      try {
        localTime = normalizeLocalTime(parsed.localTime)
      } catch {
        return NextResponse.json({ error: 'Invalid time.' }, { status: 400 })
      }
    }
    const weekday = parsed.weekday !== undefined ? parsed.weekday : existing.weekday
    const monthday = parsed.monthday !== undefined ? parsed.monthday : existing.monthday
    const month = parsed.month !== undefined ? parsed.month : existing.month
    const onceOn = parsed.onceOn !== undefined ? parsed.onceOn : existing.once_on

    if (scheduleTouched) {
      const scheduleError = validateScheduleFields({
        frequency,
        weekday,
        monthday,
        month,
        onceOn,
      })
      if (scheduleError) {
        return NextResponse.json({ error: scheduleError }, { status: 400 })
      }
      patch.frequency = frequency
      patch.timezone = timezone
      patch.local_time = localTime
      patch.weekday = weekday
      patch.monthday = monthday
      patch.month = month
      patch.once_on = onceOn
    }

    let nextStatus = existing.status
    if (parsed.status) {
      nextStatus = parsed.status
      patch.status = parsed.status
    }

    if (scheduleTouched || parsed.status === 'active') {
      try {
        const next = computeNextRunAt(
          toScheduleInput({
            frequency,
            timezone,
            localTime,
            weekday,
            monthday,
            month,
            onceOn,
          }),
          new Date()
        )
        if (frequency === 'once' && !next && nextStatus === 'active') {
          return NextResponse.json(
            { error: 'The one-time run must be in the future.' },
            { status: 400 }
          )
        }
        patch.next_run_at = next ? next.toISOString() : null
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid schedule.' },
          { status: 400 }
        )
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('automations')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Failed to update automation:', updateError)
      return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
    }

    return NextResponse.json({ automation: withCadence(updated) })
  } catch (err) {
    console.error('Automation PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/automations/[id]
 * Removes the definition and cascaded runs. Chat history is untouched.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existing, error: findError } = await supabase
      .from('automations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find automation:', findError)
      return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const { error } = await supabase.from('automations').delete().eq('id', id).eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete automation:', error)
      return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Automation DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

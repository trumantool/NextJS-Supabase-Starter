import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import {
  MAX_AUTOMATIONS_PER_USER,
  assertAgentOwned,
  assertSkillIdsVisible,
  computeCreateNextRunAt,
  parseAutomationBody,
  validateCreateInput,
} from '@/lib/automations'
import { formatCadence, scheduleFromAutomation } from '@/lib/automation-schedule'
import type { Automation, AutomationRun } from '@/lib/types'

function withCadence(row: Automation) {
  return {
    ...row,
    cadence: formatCadence(scheduleFromAutomation(row)),
  }
}

function lastRunSummary(runs: AutomationRun[] | null, automationId: string) {
  const match = (runs || []).find((r) => r.automation_id === automationId)
  if (!match) return null
  return {
    id: match.id,
    status: match.status,
    trigger: match.trigger,
    created_at: match.created_at,
    finished_at: match.finished_at,
    error: match.error,
  }
}

/**
 * GET /api/automations
 * List the current user's automations plus last-run summary.
 */
export async function GET() {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch automations:', error)
      return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
    }

    const ids = (automations || []).map((a) => a.id)
    let runs: AutomationRun[] = []
    if (ids.length > 0) {
      const { data: runRows, error: runError } = await supabase
        .from('automation_runs')
        .select('*')
        .in('automation_id', ids)
        .order('created_at', { ascending: false })

      if (runError) {
        console.error('Failed to fetch automation runs:', runError)
        return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
      }
      runs = runRows || []
    }

    return NextResponse.json({
      automations: (automations || []).map((row) => ({
        ...withCadence(row),
        lastRun: lastRunSummary(runs, row.id),
        hasInflight: runs.some(
          (r) => r.automation_id === row.id && (r.status === 'queued' || r.status === 'running')
        ),
      })),
    })
  } catch (err) {
    console.error('Automations GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/automations
 * Create a named scheduled automation for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = parseAutomationBody(await request.json().catch(() => ({})))
    const validated = validateCreateInput(parsed)
    if (validated.error || !validated.value) {
      return NextResponse.json({ error: validated.error || 'Invalid input' }, { status: 400 })
    }

    const { count, error: countError } = await supabase
      .from('automations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Failed to count automations:', countError)
      return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
    }
    if ((count ?? 0) >= MAX_AUTOMATIONS_PER_USER) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_AUTOMATIONS_PER_USER} automations.` },
        { status: 400 }
      )
    }

    const skillsOk = await assertSkillIdsVisible(supabase, user.id, validated.value.skillIds)
    if (skillsOk) {
      return NextResponse.json({ error: skillsOk }, { status: 400 })
    }

    const agentOk = await assertAgentOwned(supabase, user.id, validated.value.agentId)
    if (agentOk) {
      return NextResponse.json({ error: agentOk }, { status: 400 })
    }

    const next = computeCreateNextRunAt(validated.value)
    if (next.error) {
      return NextResponse.json({ error: next.error }, { status: 400 })
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .insert({
        user_id: user.id,
        name: validated.value.name,
        prompt: validated.value.prompt,
        status: 'active',
        frequency: validated.value.frequency,
        timezone: validated.value.timezone,
        local_time: validated.value.localTime,
        weekday: validated.value.weekday,
        monthday: validated.value.monthday,
        month: validated.value.month,
        once_on: validated.value.onceOn,
        next_run_at: next.nextRunAt ?? null,
        allow_mutations: validated.value.allowMutations,
        model_id: validated.value.modelId,
        skill_ids: validated.value.skillIds,
        agent_id: validated.value.agentId,
      })
      .select('*')
      .single()

    if (error || !automation) {
      console.error('Failed to create automation:', error)
      return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
    }

    return NextResponse.json({ automation: withCadence(automation) }, { status: 201 })
  } catch (err) {
    console.error('Automations POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

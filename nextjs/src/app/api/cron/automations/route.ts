import { NextResponse, type NextRequest } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { computeNextRunAt, scheduleFromAutomation } from '@/lib/automation-schedule'
import type { Automation } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/automations
 * Scheduler tick: enqueue due automations. Does not run the model.
 * Wake ≠ execute — `/api/workers/automations` claims and runs queued rows.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  try {
    const supabase = await createServerAdminClient()
    const nowIso = new Date().toISOString()

    const { data: due, error } = await supabase
      .from('automations')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', nowIso)
      .order('next_run_at', { ascending: true })
      .limit(20)

    if (error) {
      console.error('Failed to load due automations:', error)
      return NextResponse.json({ error: 'Failed to enqueue' }, { status: 500 })
    }

    let enqueued = 0
    for (const row of due || []) {
      const automation = row as Automation
      let nextRunAt: string | null = null
      let newStatus: 'active' | 'paused' = 'active'
      if (automation.frequency === 'once') {
        newStatus = 'paused'
        nextRunAt = null
      } else {
        try {
          const next = computeNextRunAt(scheduleFromAutomation(automation), new Date(), {
            exclusive: true,
          })
          nextRunAt = next ? next.toISOString() : null
        } catch (err) {
          console.error('Failed to compute next_run_at', automation.id, err)
          continue
        }
      }

      const { data: runId, error: enqueueError } = await supabase.rpc('enqueue_automation_run', {
        p_automation_id: automation.id,
        p_trigger: 'schedule',
        p_next_run_at: nextRunAt,
        p_new_status: newStatus,
      })

      if (enqueueError) {
        console.error('enqueue_automation_run failed', automation.id, enqueueError)
        continue
      }
      if (runId) enqueued += 1
    }

    return NextResponse.json({ enqueued })
  } catch (err) {
    console.error('Cron automations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

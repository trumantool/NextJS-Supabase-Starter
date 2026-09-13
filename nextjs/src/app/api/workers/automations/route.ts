import { NextResponse, type NextRequest } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { executeQueuedRun } from '@/lib/automation-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/workers/automations
 * Worker tick: fail stale running rows, claim queued runs, execute OpenRouter + skills.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  try {
    const supabase = await createServerAdminClient()
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { error: staleError } = await supabase
      .from('automation_runs')
      .update({
        status: 'failed',
        error: 'timed out',
        finished_at: new Date().toISOString(),
      })
      .eq('status', 'running')
      .lt('started_at', staleCutoff)

    if (staleError) {
      console.error('Failed to fail stale runs:', staleError)
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_queued_automation_runs', {
      p_limit: 5,
    })

    if (claimError) {
      console.error('Failed to claim queued runs:', claimError)
      return NextResponse.json({ error: 'Failed to claim runs' }, { status: 500 })
    }

    const runs = claimed || []
    let executed = 0
    for (const run of runs) {
      await executeQueuedRun({ supabase, runId: run.id })
      executed += 1
    }

    return NextResponse.json({ claimed: runs.length, executed })
  } catch (err) {
    console.error('Worker automations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

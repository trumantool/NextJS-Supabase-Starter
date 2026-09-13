import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/automations/[id]/run
 * Run now: enqueue a queued manual run. Does not execute the model.
 * After enqueueing, wake `/api/workers/automations` with CRON_SECRET to execute.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: automation, error: findError } = await supabase
      .from('automations')
      .select('id, user_id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find automation:', findError)
      return NextResponse.json({ error: 'Failed to enqueue run' }, { status: 500 })
    }
    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const { data: inflight } = await supabase
      .from('automation_runs')
      .select('id, status')
      .eq('automation_id', id)
      .in('status', ['queued', 'running'])
      .limit(1)

    if (inflight && inflight.length > 0) {
      return NextResponse.json(
        { error: 'A run is already queued or running for this automation.' },
        { status: 409 }
      )
    }

    const { data: run, error } = await supabase
      .from('automation_runs')
      .insert({
        automation_id: id,
        user_id: user.id,
        trigger: 'manual',
        status: 'queued',
      })
      .select('*')
      .single()

    if (error || !run) {
      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'A run is already queued or running for this automation.' },
          { status: 409 }
        )
      }
      console.error('Failed to enqueue run:', error)
      return NextResponse.json({ error: 'Failed to enqueue run' }, { status: 500 })
    }

    return NextResponse.json({ run }, { status: 201 })
  } catch (err) {
    console.error('Automation run POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

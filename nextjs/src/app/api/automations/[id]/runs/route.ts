import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/automations/[id]/runs
 * Run history for polling, including output when present.
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

    const { data: automation, error: findError } = await supabase
      .from('automations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find automation:', findError)
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }
    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const { data: runs, error } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch runs:', error)
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }

    return NextResponse.json({ runs: runs || [] })
  } catch (err) {
    console.error('Automation runs GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

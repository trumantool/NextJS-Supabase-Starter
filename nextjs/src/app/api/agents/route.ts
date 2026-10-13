import { NextResponse, type NextRequest } from 'next/server'
import { ensureBuiltinUserAgent, parseBuiltinSelection } from '@/lib/builtin-agents'
import { createBlankUserAgent } from '@/lib/clone-user-agent'
import {
  filterVisibleUserAgents,
  isRejectedTemplateClone,
} from '@/lib/starter-catalog-allowlist'
import { createSSRClient } from '@/lib/supabase/server'

/**
 * GET /api/agents
 * Current user's visible agents, newest first. Marketing clones are omitted.
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

    const { data, error } = await supabase
      .from('user_agents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch user agents:', error)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    return NextResponse.json({ agents: filterVisibleUserAgents(data || []) })
  } catch (err) {
    console.error('Agents GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/agents
 * Create a blank agent, or ensure the caller's General / Task Management row.
 * Template clones are rejected and insert nothing.
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

    const body = (await request.json().catch(() => ({}))) as {
      template_id?: unknown
      starter?: unknown
      builtin?: unknown
      name?: unknown
      system_prompt?: unknown
      skill_ids?: unknown
      defaults?: unknown
      model_id?: unknown
    }

    if (isRejectedTemplateClone(body)) {
      return NextResponse.json(
        { error: 'Templates cannot be cloned. Create a blank agent or pick General agent or Task Management.' },
        { status: 400 }
      )
    }

    const builtin = parseBuiltinSelection(body.builtin)
    if (body.builtin !== undefined && !builtin) {
      return NextResponse.json(
        { error: 'builtin must be general or task-management.' },
        { status: 400 }
      )
    }

    if (builtin) {
      const result = await ensureBuiltinUserAgent(supabase, user.id, builtin)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ agent: result.agent }, { status: 200 })
    }

    const result = await createBlankUserAgent(supabase, {
      userId: user.id,
      name: body.name || 'Untitled agent',
      system_prompt: body.system_prompt,
      skill_ids: body.skill_ids,
      defaults: body.defaults,
      model_id: body.model_id,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ agent: result.agent }, { status: 201 })
  } catch (err) {
    console.error('Agents POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

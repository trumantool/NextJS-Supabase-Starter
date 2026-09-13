import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'
import { isAdminUser, STARTER_TEMPLATE_SLUG } from '@/lib/agent-templates'
import { cloneTemplateToUserAgent, createBlankUserAgent } from '@/lib/clone-user-agent'

/**
 * GET /api/agents
 * Current user's agents, newest first.
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

    return NextResponse.json({ agents: data || [] })
  } catch (err) {
    console.error('Agents GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/agents
 * Create a blank agent, or clone a catalog / built-in starter template.
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
      name?: unknown
      system_prompt?: unknown
      skill_ids?: unknown
      defaults?: unknown
      model_id?: unknown
    }

    const admin = await isAdminUser(supabase, user.id)
    const shared = {
      userId: user.id,
      name: body.name,
      system_prompt: body.system_prompt,
      skill_ids: body.skill_ids,
      defaults: body.defaults,
      model_id: body.model_id,
    }

    if (body.starter === true || body.template_id === STARTER_TEMPLATE_SLUG) {
      const result = await cloneTemplateToUserAgent(supabase, {
        ...shared,
        templateId: STARTER_TEMPLATE_SLUG,
        name: body.name || 'Starter Assistant',
        allowUnpublished: admin,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ agent: result.agent }, { status: 201 })
    }

    if (typeof body.template_id === 'string') {
      if (!isUuid(body.template_id)) {
        return NextResponse.json({ error: 'template_id must be a valid UUID.' }, { status: 400 })
      }
      const result = await cloneTemplateToUserAgent(supabase, {
        ...shared,
        templateId: body.template_id,
        name: body.name || 'Untitled agent',
        allowUnpublished: admin,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }
      return NextResponse.json({ agent: result.agent }, { status: 201 })
    }

    const result = await createBlankUserAgent(supabase, {
      ...shared,
      name: body.name || 'Untitled agent',
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

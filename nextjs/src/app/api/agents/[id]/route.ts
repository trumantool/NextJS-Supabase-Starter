import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'
import { assertSkillIdsVisible } from '@/lib/agent-templates'
import { deleteAgentMemoryPrefix } from '@/lib/agent-memory'
import {
  parseAgentName,
  parseCloneAgentOverrides,
  parseUserAgentDefaults,
  parseUserAgentPrompt,
  parseUserAgentSkillIds,
} from '@/lib/user-agents'
import type { Json, TablesUpdate } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireOwnedAgent(id: string) {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!isUuid(id)) {
    return { error: NextResponse.json({ error: 'Invalid agent id.' }, { status: 400 }) }
  }
  const { data, error } = await supabase
    .from('user_agents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.error('Failed to fetch user agent:', error)
    return { error: NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 }) }
  }
  if (!data) {
    return { error: NextResponse.json({ error: 'Agent not found' }, { status: 404 }) }
  }
  return { supabase, user, agent: data }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedAgent(id)
    if ('error' in loaded) return loaded.error
    return NextResponse.json({ agent: loaded.agent })
  } catch (err) {
    console.error('Agent GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/agents/[id]
 * Allowlist: name, system_prompt, skill_ids, defaults / model_id.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedAgent(id)
    if ('error' in loaded) return loaded.error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const patch: TablesUpdate<'user_agents'> = {}

    if (body.name !== undefined) {
      const named = parseAgentName(body.name)
      if (named.error || !named.name) {
        return NextResponse.json({ error: named.error || 'Invalid name.' }, { status: 400 })
      }
      patch.name = named.name
    }
    if (body.system_prompt !== undefined) {
      const prompt = parseUserAgentPrompt(body.system_prompt)
      if (prompt.error || prompt.system_prompt === undefined) {
        return NextResponse.json({ error: prompt.error || 'Invalid system prompt.' }, { status: 400 })
      }
      patch.system_prompt = prompt.system_prompt
    }
    if (body.skill_ids !== undefined) {
      const skills = parseUserAgentSkillIds(body.skill_ids)
      if (skills.error || !skills.ids) {
        return NextResponse.json({ error: skills.error || 'Invalid skill ids.' }, { status: 400 })
      }
      const visible = await assertSkillIdsVisible(loaded.supabase, loaded.user.id, skills.ids)
      if (visible) {
        return NextResponse.json({ error: visible }, { status: 400 })
      }
      patch.skill_ids = skills.ids
    }
    if (body.defaults !== undefined || body.model_id !== undefined) {
      const defaults = parseCloneAgentOverrides({
        defaults: body.defaults,
        model_id: body.model_id,
      })
      if (defaults.error || !defaults.overrides?.defaults) {
        const fallback = parseUserAgentDefaults(body.defaults ?? { model_id: body.model_id })
        if (fallback.error || !fallback.defaults) {
          return NextResponse.json({ error: fallback.error || 'Invalid defaults.' }, { status: 400 })
        }
        patch.defaults = fallback.defaults as Json
      } else {
        const current =
          loaded.agent.defaults && typeof loaded.agent.defaults === 'object' && !Array.isArray(loaded.agent.defaults)
            ? loaded.agent.defaults
            : {}
        patch.defaults = { ...current, ...defaults.overrides.defaults } as Json
      }
    }

    const forbidden = [
      'required_toolkits',
      'mcp_config',
      'source_template_id',
      'source_template_name',
      'user_id',
      'memory_config',
    ]
    if (forbidden.some((key) => key in body)) {
      return NextResponse.json(
        { error: 'Those fields cannot be changed on an agent in v1.' },
        { status: 400 }
      )
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await loaded.supabase
      .from('user_agents')
      .update(patch)
      .eq('id', id)
      .eq('user_id', loaded.user.id)
      .select('*')
      .single()

    if (error || !data) {
      console.error('Failed to update user agent:', error)
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
    }

    return NextResponse.json({ agent: data })
  } catch (err) {
    console.error('Agent PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const loaded = await requireOwnedAgent(id)
    if ('error' in loaded) return loaded.error

    const { error } = await loaded.supabase
      .from('user_agents')
      .delete()
      .eq('id', id)
      .eq('user_id', loaded.user.id)

    if (error) {
      console.error('Failed to delete user agent:', error)
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
    }

    try {
      await deleteAgentMemoryPrefix({
        supabase: loaded.supabase,
        userId: loaded.user.id,
        agentId: id,
      })
    } catch (err) {
      console.error('Best-effort memory prefix delete failed:', err)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Agent DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

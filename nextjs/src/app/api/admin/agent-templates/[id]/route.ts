import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/ids'
import { createSSRClient } from '@/lib/supabase/server'
import { isAdminUser, publishRecipeError } from '@/lib/agent-templates'
import { parseTemplateWrite, templatePatchPayload } from '@/lib/agent-template-write'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireAdmin() {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(await isAdminUser(supabase, user.id))) {
    return { error: NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { data: existing, error: findError } = await auth.supabase
      .from('agent_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find agent template:', findError)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const parsed = await parseTemplateWrite(body, { supabase: auth.supabase, partial: true })
    if (parsed.error || !parsed.value) {
      return NextResponse.json({ error: parsed.error || 'Invalid input' }, { status: 400 })
    }

    const next = {
      name: body.name !== undefined ? parsed.value.name : existing.name,
      slug: body.slug !== undefined ? parsed.value.slug : existing.slug,
      system_prompt:
        body.system_prompt !== undefined ? parsed.value.system_prompt : existing.system_prompt,
      skill_ids: body.skill_ids !== undefined ? parsed.value.skill_ids : existing.skill_ids,
      status: body.status !== undefined ? parsed.value.status : existing.status,
    }

    if (next.status === 'published') {
      const publishError = publishRecipeError(next)
      if (publishError) {
        return NextResponse.json({ error: publishError }, { status: 400 })
      }
    }

    const patch = templatePatchPayload({
      ...(body.name !== undefined ? { name: parsed.value.name } : {}),
      ...(body.slug !== undefined ? { slug: parsed.value.slug } : {}),
      ...(body.description !== undefined ? { description: parsed.value.description } : {}),
      ...(body.status !== undefined ? { status: parsed.value.status } : {}),
      ...(body.system_prompt !== undefined ? { system_prompt: parsed.value.system_prompt } : {}),
      ...(body.skill_ids !== undefined ? { skill_ids: parsed.value.skill_ids } : {}),
      ...(body.defaults !== undefined || body.model_id !== undefined
        ? { defaults: parsed.value.defaults }
        : {}),
    })

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('agent_templates')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'A template with this slug already exists.' }, { status: 409 })
      }
      console.error('Failed to update agent template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error('Admin agent-templates PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 })
    }

    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { data: existing, error: findError } = await auth.supabase
      .from('agent_templates')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('Failed to find agent template:', findError)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const { error } = await auth.supabase.from('agent_templates').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete agent template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin agent-templates DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

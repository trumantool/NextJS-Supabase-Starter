import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/agent-templates'
import {
  parseTemplateWrite,
  starterTemplateWrite,
  templateInsertPayload,
} from '@/lib/agent-template-write'

/**
 * POST /api/admin/agent-templates
 * Create a catalog template (default draft).
 * Pass { starter: true } to publish the built-in Starter Assistant once.
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
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const parsed = body.starter === true
      ? { value: starterTemplateWrite(), error: undefined }
      : await parseTemplateWrite(body, { supabase, partial: false })

    if (parsed.error || !parsed.value) {
      return NextResponse.json({ error: parsed.error || 'Invalid input' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('agent_templates')
      .insert(templateInsertPayload(parsed.value, user.id))
      .select('*')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'A template with this slug already exists.' }, { status: 409 })
      }
      console.error('Failed to create agent template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err) {
    console.error('Admin agent-templates POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

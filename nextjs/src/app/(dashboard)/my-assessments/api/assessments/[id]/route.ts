// My Assessments API — PATCH rename / DELETE assessments.
// Follows the API-route pattern (resume-builder style) to avoid
// calling server actions directly from client components.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/assessments/[id] — rename an assessment (user's own) */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { name?: string }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Assessment name cannot be empty' }, { status: 400 })
    }

    // Verify ownership + update (RLS also protects, but be explicit)
    const query = supabase
      .from('text_assessments')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ assessment: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to rename assessment' },
      { status: 500 }
    )
  }
}

/** DELETE /api/assessments/[id] — delete an assessment (user's own) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership + delete (answers cascade via FK)
    const query = supabase
      .from('text_assessments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete assessment' },
      { status: 500 }
    )
  }
}
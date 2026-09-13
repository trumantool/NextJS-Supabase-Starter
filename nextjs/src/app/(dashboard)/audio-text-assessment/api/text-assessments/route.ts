// Text Assessment API — GET list / POST create assessments.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = supabase
      .from('text_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assessments: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list assessments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { name?: string }
    const name = body.name?.trim() || 'Untitled Assessment'

    const query = supabase
      .from('text_assessments')
      .insert({ user_id: user.id, name })
      .select()
      .single()

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assessment: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create assessment' },
      { status: 500 }
    )
  }
}

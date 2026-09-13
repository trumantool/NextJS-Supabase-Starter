import { NextResponse, type NextRequest } from 'next/server'
import { fetchUserTagCatalog } from '@/lib/chat-tags'
import { createSSRClient } from '@/lib/supabase/server'

const MAX_TAG_NAME = 40
const COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * GET /api/tags — current user's tag catalog.
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
    const tags = await fetchUserTagCatalog(supabase, user.id)
    return NextResponse.json({ tags })
  } catch (err) {
    console.error('Tags GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tags — create a session tag for the current user.
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
      name?: unknown
      color?: unknown
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }
    const name = body.name.trim().slice(0, MAX_TAG_NAME)
    let color: string | null = null
    if (body.color !== undefined && body.color !== null && body.color !== '') {
      if (typeof body.color !== 'string' || !COLOR_RE.test(body.color)) {
        return NextResponse.json({ error: 'color must be a hex value like #3366ff.' }, { status: 400 })
      }
      color = body.color
    }

    const { data, error } = await supabase
      .from('session_tags')
      .insert({ user_id: user.id, name, color })
      .select('id, name, color')
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'A tag with that name already exists.' }, { status: 409 })
      }
      console.error('Failed to create tag:', error)
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
    }

    return NextResponse.json({ tag: data }, { status: 201 })
  } catch (err) {
    console.error('Tags POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

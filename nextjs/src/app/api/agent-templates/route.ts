import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { isAdminUser, withBuiltinStarter } from '@/lib/agent-templates'

/**
 * GET /api/agent-templates
 * Published catalog for every signed-in user.
 * Admins may pass ?status=all to include drafts.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wantAll = request.nextUrl.searchParams.get('status') === 'all'
    const admin = wantAll ? await isAdminUser(supabase, user.id) : false

    let query = supabase
      .from('agent_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (!admin) {
      query = query.eq('status', 'published')
    }

    const { data, error } = await query
    if (error) {
      console.error('Failed to fetch agent templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: withBuiltinStarter(data || []) })
  } catch (err) {
    console.error('Agent templates GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

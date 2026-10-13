import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { withBuiltinStarter } from '@/lib/agent-templates'
import { filterVisibleTemplates } from '@/lib/starter-catalog-allowlist'

/**
 * GET /api/agent-templates
 * Returns at most the code General template. Database recipes stay hidden,
 * including when ?status=all is passed.
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
      .from('agent_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch agent templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: withBuiltinStarter(filterVisibleTemplates(data || [])) })
  } catch (err) {
    console.error('Agent templates GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

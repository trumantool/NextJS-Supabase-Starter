// Documents — GET: OpenRouter model list (admin dropdown).
import { NextResponse } from 'next/server'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { createSSRClient } from '@/lib/supabase/server'
import { listOpenRouterModels } from '../../lib/openrouter'
import { getOpenRouterModel } from '../../lib/supabase-documents'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    const [models, current] = await Promise.all([
      listOpenRouterModels(),
      getOpenRouterModel(),
    ])

    return NextResponse.json({ models, current })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load models' },
      { status: 500 }
    )
  }
}

// Resume Builder — GET: OpenRouter model list (admin dropdown).
import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { listOpenRouterModels } from '../../lib/openrouter'
import { getOpenRouterModel } from '../../lib/supabase-resumes'

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
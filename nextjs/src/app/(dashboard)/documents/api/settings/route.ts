// Documents — POST: persist the admin-chosen OpenRouter model in app_settings.
import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { createSSRClient } from '@/lib/supabase/server'
import { setOpenRouterModel } from '../../lib/supabase-documents'

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as { model?: string }
    if (!body.model || typeof body.model !== 'string') {
      return NextResponse.json({ error: 'model is required' }, { status: 400 })
    }

    await setOpenRouterModel(body.model)
    return NextResponse.json({ ok: true, model: body.model })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save model' },
      { status: 500 }
    )
  }
}

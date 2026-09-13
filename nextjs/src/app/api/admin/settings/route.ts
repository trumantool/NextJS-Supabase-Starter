import { NextResponse, type NextRequest } from 'next/server'
import { getAdminSettings, updateAdminSetting } from '@/app/(dashboard)/admin/actions'

/**
 * GET /api/admin/settings
 * Returns all admin settings (admin only). Mirrors the working resume API-route
 * pattern (avoids the React Server Actions transport).
 */
export async function GET() {
  try {
    const settings = await getAdminSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load settings'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Admin settings GET error:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/admin/settings
 * Updates a single admin setting's value (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; value?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'Setting id is required.' }, { status: 400 })
    }
    const updated = await updateAdminSetting(body.id, body.value ?? '')
    return NextResponse.json({ success: true, setting: updated }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save setting'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Admin settings POST error:', err)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
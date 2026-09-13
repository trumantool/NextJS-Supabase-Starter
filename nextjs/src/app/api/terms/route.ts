import { NextResponse, type NextRequest } from 'next/server'
import { updateTermsOfService } from '@/lib/actions/terms'

/**
 * POST /api/terms
 * Saves the Terms of Service content (admin only). Mirrors the working resume
 * API-route pattern (avoids the React Server Actions transport).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { content?: string }
    const content = body.content ?? ''

    if (!content) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    const updated = await updateTermsOfService(content)
    return NextResponse.json({ success: true, setting: updated }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save Terms of Service'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Terms save error:', err)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
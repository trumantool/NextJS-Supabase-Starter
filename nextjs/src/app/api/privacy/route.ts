import { NextResponse, type NextRequest } from 'next/server'
import { updatePrivacyPolicy } from '@/lib/actions/privacy'

/**
 * POST /api/privacy
 * Saves the privacy policy content (admin only). Mirrors the working resume
 * API-route pattern (avoids the React Server Actions transport).
 * Returns 401/403/500 with an error message on failure.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { content?: string }
    const content = body.content ?? ''

    if (!content) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 })
    }

    const updated = await updatePrivacyPolicy(content)
    return NextResponse.json({ success: true, setting: updated }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save privacy policy'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Privacy save error:', err)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
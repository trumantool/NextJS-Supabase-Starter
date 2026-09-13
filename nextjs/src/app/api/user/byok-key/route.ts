import { NextResponse, type NextRequest } from 'next/server'
import {
  clearByokKeyForCurrentUser,
  getByokStatusForCurrentUser,
  saveByokKeyForCurrentUser,
} from '@/lib/byok'

/**
 * GET /api/user/byok-key
 * Returns masked status only. Never returns the raw key.
 */
export async function GET() {
  try {
    const status = await getByokStatusForCurrentUser()
    return NextResponse.json(status, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load key status'
    const status = message === 'Unauthorized' ? 401 : 500
    console.error('BYOK key GET error:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * POST /api/user/byok-key
 * Save the user's OpenRouter key via service role after auth.
 * Never returns the key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { key?: string }
    await saveByokKeyForCurrentUser(body.key ?? '')
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save key'
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Key is required' || message === 'Invalid OpenRouter key format'
          ? 400
          : 500
    console.error('BYOK key POST error:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * DELETE /api/user/byok-key
 * Remove the user's OpenRouter key.
 */
export async function DELETE() {
  try {
    await clearByokKeyForCurrentUser()
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove key'
    const status = message === 'Unauthorized' ? 401 : 500
    console.error('BYOK key DELETE error:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

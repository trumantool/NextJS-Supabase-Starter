import { NextResponse, type NextRequest } from 'next/server'
import {
  getSocialProfileForCurrentUser,
  updateSocialProfileForCurrentUser,
} from '@/lib/social-profile-store'

function statusForError(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message === 'Profile not found') return 404
  if (
    message === 'Social profile columns are not available' ||
    message.includes('must be a valid http(s) URL') ||
    message.includes('must be a URL') ||
    message.includes('is too long')
  ) {
    return 400
  }
  return 500
}

/**
 * GET /api/user/social-profile
 * Returns only social columns that exist on public.user_data at runtime.
 */
export async function GET() {
  try {
    const profile = await getSocialProfileForCurrentUser()
    return NextResponse.json(profile, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load social profile'
    console.error('Social profile GET error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

/**
 * PUT /api/user/social-profile
 * Updates social URL fields after auth. Writes only columns that exist.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const result = await updateSocialProfileForCurrentUser(body)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save social profile'
    console.error('Social profile PUT error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

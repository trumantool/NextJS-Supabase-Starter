import { NextResponse, type NextRequest } from 'next/server'
import { getProfileForCurrentUser, updateProfileNames } from '@/lib/profile-store'

function statusForError(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message.includes('must be')) return 400
  return 500
}

export async function GET() {
  try {
    const profile = await getProfileForCurrentUser()
    return NextResponse.json(profile)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile'
    console.error('Profile GET error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { first_name?: unknown; last_name?: unknown }
    const profile = await updateProfileNames(body)
    return NextResponse.json(profile)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save profile'
    console.error('Profile PUT error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

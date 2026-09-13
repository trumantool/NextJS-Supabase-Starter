import { NextResponse, type NextRequest } from 'next/server'
import { updateContactSubmissionStatus } from '@/app/(dashboard)/admin/actions'

/**
 * POST /api/admin/submissions
 * Updates a contact submission's status (admin only). Mirrors the working
 * resume API-route pattern (avoids the React Server Actions transport).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; status?: string }
    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: 'id and status are required.' },
        { status: 400 }
      )
    }
    const updated = await updateContactSubmissionStatus(body.id, body.status)
    return NextResponse.json({ success: true, submission: updated }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update status'
    const status = message === 'Unauthorized' ? 401 : message.includes('admin') ? 403 : 500
    console.error('Submission status update error:', err)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
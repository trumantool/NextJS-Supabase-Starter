import { NextResponse, type NextRequest } from 'next/server'

export function unauthorizedCron(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Vercel Cron and manual worker curls must send `Authorization: Bearer $CRON_SECRET`.
 * Rejects when the secret is unset so a missing env var cannot open the endpoints.
 */
export function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return unauthorizedCron()
  }
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token !== secret) {
    return unauthorizedCron()
  }
  return null
}

import { NextResponse, type NextRequest } from 'next/server'
import { httpStatusForPostError, NEWSLETTER_OK, normalizeNewsletterEmail, requirePostWebsite } from '@/lib/posts'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const email = normalizeNewsletterEmail(payload?.email)
    const website = requirePostWebsite(process.env.POSTS_WEBSITE)
    const admin = await createServerAdminClient()
    const { error } = await admin.from('newsletter_subscribers').upsert(
      { website, email, status: 'confirmed' },
      { onConflict: 'website,email' }
    )
    if (error) throw new Error(error.message)
    return NextResponse.json({ message: NEWSLETTER_OK })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save address'
    console.error('Newsletter signup failed')
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

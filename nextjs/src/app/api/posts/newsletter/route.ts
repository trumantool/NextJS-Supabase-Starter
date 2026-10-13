import { NextResponse, type NextRequest } from 'next/server'
import {
  httpStatusForPostError,
  isMissingBlogSchemaError,
  logBlogSchemaGap,
  NEWSLETTER_OK,
  normalizeNewsletterEmail,
  requirePostWebsite,
} from '@/lib/posts'
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
    if (error) {
      if (isMissingBlogSchemaError(error)) {
        logBlogSchemaGap('newsletter_subscribers', error)
        return NextResponse.json({ error: 'Newsletter signups are unavailable.' }, { status: 503 })
      }
      console.error('Newsletter signup failed', error.code ?? '')
      throw new Error('Failed to save address')
    }
    return NextResponse.json({ message: NEWSLETTER_OK })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save address'
    console.error('Newsletter signup failed')
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

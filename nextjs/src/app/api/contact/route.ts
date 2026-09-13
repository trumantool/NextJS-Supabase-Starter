import { NextResponse, type NextRequest } from 'next/server'
import { submitContactForm } from '@/lib/actions/contact'

/**
 * POST /api/contact
 * Submits the contact form. Mirrors the working resume API-route pattern
 * (avoids the React Server Actions transport).
 * Accepts anonymous and authenticated submissions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      firstName?: string
      lastName?: string
      emailAddress?: string
      phoneNumber?: string
      message?: string
    }

    const result = await submitContactForm({
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      emailAddress: body.emailAddress ?? '',
      phoneNumber: body.phoneNumber,
      message: body.message ?? '',
    })

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    console.error('Contact submit error:', err)
    return NextResponse.json(
      { success: false, message: 'There was a problem submitting your message. Please try again.' },
      { status: 500 }
    )
  }
}
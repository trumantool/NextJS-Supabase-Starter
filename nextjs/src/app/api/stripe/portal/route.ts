import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
    }

    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('user_data')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer is linked to this account yet' },
        { status: 400 }
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/user-settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not open the billing portal'
    console.error('Stripe portal error:', err)
    const status = message === 'Stripe is not configured' ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

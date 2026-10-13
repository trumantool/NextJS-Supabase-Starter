import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { checkoutPriceId, getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const price = checkoutPriceId()
    if (!price || !process.env.STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json({ error: 'Stripe checkout is not configured' }, { status: 503 })
    }

    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_data')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profileError) throw new Error(profileError.message)

    const stripe = getStripe()
    let customerId = profile?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      const admin = await createServerAdminClient()
      const { error: saveError } = await admin
        .from('user_data')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
      if (saveError) throw new Error(saveError.message)
    }

    const origin = request.nextUrl.origin
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/user-settings?billing=success`,
      cancel_url: `${origin}/user-settings?billing=cancel`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout session had no URL' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    console.error('Stripe checkout error:', err)
    const status = message === 'Stripe is not configured' ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

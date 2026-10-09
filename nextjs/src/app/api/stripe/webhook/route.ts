import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { billingSyncFromSubscription, getStripe, stripeWebhookSecret } from '@/lib/stripe'

export const runtime = 'nodejs'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

async function resolveUserId(input: {
  metadataUserId?: string | null
  clientReferenceId?: string | null
  customerId?: string | null
}): Promise<string | null> {
  const admin = await createServerAdminClient()
  const hinted = input.metadataUserId || input.clientReferenceId || ''
  if (UUID.test(hinted)) {
    const { data } = await admin
      .from('user_data')
      .select('user_id')
      .eq('user_id', hinted)
      .maybeSingle()
    if (data?.user_id) return data.user_id
  }
  if (input.customerId) {
    const { data } = await admin
      .from('user_data')
      .select('user_id')
      .eq('stripe_customer_id', input.customerId)
      .maybeSingle()
    if (data?.user_id) return data.user_id
  }
  return null
}

async function applySubscription(
  subscription: Stripe.Subscription,
  hints: { userId?: string | null }
): Promise<boolean> {
  const customerId = customerIdOf(subscription.customer)
  const userId = await resolveUserId({
    metadataUserId: subscription.metadata?.user_id ?? hints.userId,
    customerId,
  })
  if (!userId) {
    console.error('Stripe webhook: no user for subscription', subscription.id)
    return false
  }

  const billing = billingSyncFromSubscription(subscription, customerId)
  const admin = await createServerAdminClient()
  const { error } = await admin
    .from('user_data')
    .update({
      plan: billing.plan,
      plan_status: billing.plan_status,
      stripe_customer_id: billing.stripe_customer_id,
      stripe_subscription_id: billing.stripe_subscription_id,
      current_period_end: billing.current_period_end,
    })
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return true
}

export async function POST(request: Request) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, stripeWebhookSecret())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('Stripe webhook signature:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (!subscriptionId) break
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        await applySubscription(subscription, {
          userId: session.metadata?.user_id ?? session.client_reference_id,
        })
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await applySubscription(event.data.object, {
          userId: event.data.object.metadata?.user_id,
        })
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('Stripe webhook handler:', event.type, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

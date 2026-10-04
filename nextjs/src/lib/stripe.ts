import Stripe from 'stripe'
import {
  billingFromStripe,
  defaultCheckoutPriceId,
  parsePricePlanMap,
  type BillingSync,
} from '@/lib/stripe-billing'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('Stripe is not configured')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error('Stripe webhook secret is not configured')
  return secret
}

export function stripePricePlanMap(): Map<string, string> {
  return parsePricePlanMap(process.env.STRIPE_PRICE_PLAN_MAP)
}

export function checkoutPriceId(): string | null {
  return defaultCheckoutPriceId({
    priceId: process.env.STRIPE_PRICE_ID,
    planMap: stripePricePlanMap(),
  })
}

export function stripeConfigStatus() {
  return {
    publishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
    secretConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    priceConfigured: Boolean(checkoutPriceId()),
  }
}

export function billingSyncFromSubscription(
  subscription: Stripe.Subscription,
  customerId: string | null
): BillingSync {
  const priceId = subscription.items.data[0]?.price?.id ?? null
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
  return billingFromStripe({
    status: subscription.status,
    priceId,
    customerId,
    subscriptionId: subscription.id,
    periodEndIso: periodEnd,
    planMap: stripePricePlanMap(),
  })
}

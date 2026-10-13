export type BillingSync = {
  plan: string
  plan_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
}

const PLAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const KEEPS_PAID_PLAN = new Set(['active', 'trialing', 'past_due', 'paused', 'unpaid'])

/** `price_123:pro,price_456=team` */
export function parsePricePlanMap(raw: string | undefined | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw) return map
  for (const part of raw.split(',')) {
    const piece = part.trim()
    if (!piece) continue
    const splitAt = piece.includes(':') ? piece.indexOf(':') : piece.indexOf('=')
    if (splitAt <= 0) continue
    const priceId = piece.slice(0, splitAt).trim()
    const plan = piece.slice(splitAt + 1).trim().toLowerCase()
    if (!priceId.startsWith('price_') || !PLAN_SLUG.test(plan)) continue
    map.set(priceId, plan)
  }
  return map
}

export function defaultCheckoutPriceId(input: {
  priceId?: string | null
  planMap: ReadonlyMap<string, string>
}): string | null {
  const explicit = input.priceId?.trim() ?? ''
  if (explicit) return explicit
  const first = input.planMap.keys().next()
  return first.done ? null : first.value
}

export function billingFromStripe(input: {
  status: string
  priceId: string | null
  customerId: string | null
  subscriptionId: string | null
  periodEndIso: string | null
  planMap: ReadonlyMap<string, string>
}): BillingSync {
  const status = input.status.trim() || 'inactive'
  const mapped = input.priceId ? input.planMap.get(input.priceId) : undefined
  const plan = KEEPS_PAID_PLAN.has(status) ? mapped || 'paid' : 'free'
  return {
    plan,
    plan_status: status,
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    current_period_end: input.periodEndIso,
  }
}

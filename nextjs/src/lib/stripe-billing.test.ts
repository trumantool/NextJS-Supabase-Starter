import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { billingFromStripe, defaultCheckoutPriceId, parsePricePlanMap } from './stripe-billing.ts'

describe('parsePricePlanMap', () => {
  it('reads colon and equals separators and skips junk', () => {
    const map = parsePricePlanMap('price_pro:pro, price_team=team, nope, price_bad:Not A Plan')
    assert.equal(map.get('price_pro'), 'pro')
    assert.equal(map.get('price_team'), 'team')
    assert.equal(map.size, 2)
  })
})

describe('defaultCheckoutPriceId', () => {
  it('prefers an explicit price id, otherwise the first mapped price', () => {
    const planMap = parsePricePlanMap('price_aaa:pro,price_bbb:team')
    assert.equal(defaultCheckoutPriceId({ priceId: 'price_explicit', planMap }), 'price_explicit')
    assert.equal(defaultCheckoutPriceId({ priceId: '  ', planMap }), 'price_aaa')
    assert.equal(defaultCheckoutPriceId({ planMap: new Map() }), null)
  })
})

describe('billingFromStripe', () => {
  const planMap = parsePricePlanMap('price_pro:pro')

  it('keeps a mapped plan while the subscription is still billable', () => {
    const billing = billingFromStripe({
      status: 'active',
      priceId: 'price_pro',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      periodEndIso: '2026-11-01T00:00:00.000Z',
      planMap,
    })
    assert.equal(billing.plan, 'pro')
    assert.equal(billing.plan_status, 'active')
    assert.equal(billing.stripe_customer_id, 'cus_1')
    assert.equal(billing.stripe_subscription_id, 'sub_1')
  })

  it('falls back to paid when the price is unmapped and to free when canceled', () => {
    const paid = billingFromStripe({
      status: 'trialing',
      priceId: 'price_unknown',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      periodEndIso: null,
      planMap,
    })
    assert.equal(paid.plan, 'paid')
    const free = billingFromStripe({
      status: 'canceled',
      priceId: 'price_pro',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      periodEndIso: null,
      planMap,
    })
    assert.equal(free.plan, 'free')
    assert.equal(free.plan_status, 'canceled')
  })
})

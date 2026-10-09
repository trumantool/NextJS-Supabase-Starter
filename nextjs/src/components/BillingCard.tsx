'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'

type ProfileBilling = {
  plan: string
  plan_status: string
  current_period_end: string | null
  stripe_customer_id: string | null
  error?: string
}

type StripeConfig = {
  secretConfigured: boolean
  priceConfigured: boolean
}

export function BillingCard() {
  const [profile, setProfile] = useState<ProfileBilling | null>(null)
  const [config, setConfig] = useState<StripeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billing = params.get('billing')
    if (billing === 'success') {
      setNotice('Checkout completed. Your plan updates when Stripe sends the webhook.')
    } else if (billing === 'cancel') {
      setNotice('Checkout was canceled. Your plan is unchanged.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [profileRes, configRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/stripe/config'),
        ])
        const profileData = (await profileRes.json()) as ProfileBilling
        const configData = (await configRes.json()) as StripeConfig
        if (!profileRes.ok) throw new Error(profileData.error || 'Failed to load billing')
        if (cancelled) return
        setProfile(profileData)
        setConfig(configData)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load billing')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function start(path: '/api/stripe/checkout' | '/api/stripe/portal', kind: 'checkout' | 'portal') {
    setBusy(kind)
    setError('')
    try {
      const res = await fetch(path, { method: 'POST' })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Stripe did not return a URL')
      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing request failed')
      setBusy(null)
    }
  }

  const period = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleString()
    : '—'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Plan
        </CardTitle>
        <CardDescription>Plan and status come from Stripe. They are not edited here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-gray-500">Loading plan…</p> : null}
        {profile ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-gray-500">Plan</dt>
              <dd className="mt-1">{profile.plan}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Status</dt>
              <dd className="mt-1">{profile.plan_status}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Current period ends</dt>
              <dd className="mt-1">{period}</dd>
            </div>
          </dl>
        ) : null}
        {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={busy !== null || !config?.secretConfigured || !config?.priceConfigured}
            onClick={() => start('/api/stripe/checkout', 'checkout')}
          >
            {busy === 'checkout' ? 'Opening checkout…' : 'Subscribe'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !profile?.stripe_customer_id}
            onClick={() => start('/api/stripe/portal', 'portal')}
          >
            {busy === 'portal' ? 'Opening portal…' : 'Manage billing'}
          </Button>
        </div>
        {config && (!config.secretConfigured || !config.priceConfigured) ? (
          <p className="text-sm text-gray-500">
            Checkout needs STRIPE_SECRET_KEY and a price (STRIPE_PRICE_ID or STRIPE_PRICE_PLAN_MAP).
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

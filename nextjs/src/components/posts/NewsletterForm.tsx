'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const response = await fetch('/api/posts/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!response.ok) {
        setError(data.error ?? 'Could not save that address')
        return
      }
      setEmail('')
      setMessage(data.message ?? "You're on the list.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">Newsletter</h2>
        <p className="text-sm text-muted-foreground">
          Leave your address. We store it and do not send mail from here.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="newsletter-email" className="sr-only">
            Email
          </label>
          <Input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="flex-1"
          />
          <Button type="submit" disabled={pending}>
            Subscribe
          </Button>
        </form>
        {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

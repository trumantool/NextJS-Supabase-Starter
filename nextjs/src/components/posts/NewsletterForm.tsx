'use client'

import { useState, type FormEvent } from 'react'

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
    <form onSubmit={onSubmit} className="mt-12 rounded-lg bg-white p-4 ring-1 ring-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Newsletter</h2>
      <p className="mt-1 text-sm text-gray-600">Leave your address. We store it and do not send mail from here.</p>
      <div className="mt-3 flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Subscribe
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-gray-600">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </form>
  )
}

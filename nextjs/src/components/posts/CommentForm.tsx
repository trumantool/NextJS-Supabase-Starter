'use client'

import { useState, type FormEvent } from 'react'

export function CommentForm({ slug }: { slug: string }) {
  const [body, setBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const response = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, body }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error ?? 'Could not save the comment')
        return
      }
      setBody('')
      setMessage('Your comment is waiting for review.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <label htmlFor="comment-body" className="sr-only">
        Comment
      </label>
      <textarea
        id="comment-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={2000}
        required
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        Post comment
      </button>
      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, Loader2 } from 'lucide-react'

export function ByokSettingsCard() {
  const [hasKey, setHasKey] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/user/byok-key')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to load key status')
        if (cancelled) return
        setHasKey(Boolean(data.hasKey))
        setHint(typeof data.hint === 'string' ? data.hint : null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load key status')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/user/byok-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save key')
      const statusRes = await fetch('/api/user/byok-key')
      const status = await statusRes.json()
      setHasKey(Boolean(status.hasKey))
      setHint(typeof status.hint === 'string' ? status.hint : null)
      setKeyInput('')
      setSuccess('OpenRouter key saved. The full key is not shown again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/user/byok-key', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to remove key')
      setHasKey(false)
      setHint(null)
      setKeyInput('')
      setSuccess('OpenRouter key removed. AI features will use the platform key.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove key')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          OpenRouter API key
        </CardTitle>
        <CardDescription>
          Optional bring-your-own key. Stored server-side only. The browser
          never receives the full value after save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading key status…
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Status:{' '}
            {hasKey ? (
              <span className="font-medium text-gray-900">
                Saved {hint ? `(${hint})` : ''}
              </span>
            ) : (
              <span className="font-medium text-gray-900">Not configured</span>
            )}
          </p>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label htmlFor="openrouter-key" className="block text-sm font-medium text-gray-700">
              {hasKey ? 'Replace key' : 'OpenRouter key'}
            </label>
            <input
              id="openrouter-key"
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-or-v1-…"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Keys start with <code>sk-or-v1-</code>. Create one at openrouter.ai/keys.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !keyInput.trim()}
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save key'}
            </button>
            {hasKey ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {removing ? 'Removing…' : 'Remove key'}
              </button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

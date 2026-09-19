'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Globe } from 'lucide-react'
import {
  SOCIAL_PROFILE_FIELDS,
  type SocialProfileColumn,
} from '@/lib/social-profile'

type SocialProfileResponse = {
  columns: SocialProfileColumn[]
  values: Record<string, string>
}

export function SocialProfileSettingsCard() {
  const [columns, setColumns] = useState<SocialProfileColumn[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/user/social-profile')
        const data = (await res.json()) as SocialProfileResponse & { error?: string }
        if (!res.ok) throw new Error(data?.error || 'Failed to load social profile')
        if (cancelled) return
        setColumns(data.columns ?? [])
        setValues(data.values ?? {})
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load social profile')
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
      const payload: Record<string, string> = {}
      for (const column of columns) {
        payload[column] = values[column] ?? ''
      }
      const res = await fetch('/api/user/social-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data?.error || 'Failed to save social profile')
      setSuccess('Social profile links saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save social profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return null
  }

  if (columns.length === 0 && !error) {
    return null
  }

  if (columns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Social profiles
          </CardTitle>
          <CardDescription>Optional profile links on your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const visibleFields = SOCIAL_PROFILE_FIELDS.filter((field) =>
    columns.includes(field.column)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Social profiles
        </CardTitle>
        <CardDescription>
          Optional links on your account. These fields appear only when the
          matching columns exist on your user profile table.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSave} className="space-y-4">
          {visibleFields.map((field) => (
            <div key={field.column}>
              <label
                htmlFor={field.column}
                className="block text-sm font-medium text-gray-700"
              >
                {field.label}
              </label>
              <input
                id={field.column}
                name={field.column}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={values[field.column] ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setValues((current) => ({
                    ...current,
                    [field.column]: nextValue,
                  }))
                }}
                placeholder={field.placeholder}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save social profiles'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}

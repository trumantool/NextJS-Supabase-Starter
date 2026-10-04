'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User } from 'lucide-react'

type ProfileResponse = {
  first_name: string
  last_name: string
  error?: string
}

export function ProfileNamesCard() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/user/profile')
        const data = (await res.json()) as ProfileResponse
        if (!res.ok) throw new Error(data.error || 'Failed to load profile')
        if (cancelled) return
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
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
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      })
      const data = (await res.json()) as ProfileResponse
      if (!res.ok) throw new Error(data.error || 'Failed to save name')
      setFirstName(data.first_name ?? '')
      setLastName(data.last_name ?? '')
      setSuccess('Name saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Name
        </CardTitle>
        <CardDescription>First and last name stored on your profile</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Loading name…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                  First name
                </label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={80}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                  Last name
                </label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={80}
                  className="mt-1"
                />
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-green-700">{success}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save name'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

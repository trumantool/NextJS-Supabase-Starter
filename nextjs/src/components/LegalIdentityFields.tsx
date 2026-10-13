'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react'
import { LEGAL_IDENTITY_FIELDS, type LegalSettingLike } from '@/lib/legal-pages'
import type { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

type Props = {
  settings: readonly LegalSettingLike[]
  onSaved: (settings: AdminSetting[]) => void
}

function valueOf(settings: readonly LegalSettingLike[], name: string): string {
  return settings.find((setting) => setting.option_name === name)?.option_value ?? ''
}

export function LegalIdentityFields({ settings, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of LEGAL_IDENTITY_FIELDS) {
      initial[field.option_name] = valueOf(settings, field.option_name)
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/legal-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: values }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string; settings?: AdminSetting[] }
      if (!res.ok || !data.success || !data.settings) {
        throw new Error(data.error || 'Failed to save legal settings')
      }
      onSaved(data.settings)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save legal settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="mb-8 space-y-4 rounded-lg border border-gray-200 p-4">
      <legend className="px-1 text-sm font-medium text-gray-700">Legal details</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {LEGAL_IDENTITY_FIELDS.map((field) => (
          <label key={field.option_name} className="block space-y-1 text-sm">
            <span className="font-medium text-gray-800">{field.option_title}</span>
            <Input
              value={values[field.option_name] ?? ''}
              onChange={(event) => {
                setSaved(false)
                setValues((prev) => ({ ...prev, [field.option_name]: event.target.value }))
              }}
            />
            <span className="block text-xs text-muted-foreground">{field.option_description}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          ) : null}
          {error ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          ) : null}
        </div>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save details'}
        </Button>
      </div>
    </fieldset>
  )
}

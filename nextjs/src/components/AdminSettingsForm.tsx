'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'> & { secret_is_set?: boolean }

export function AdminSettingsForm() {
  const [settings, setSettings] = useState<AdminSetting[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Load settings on mount
  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to load settings')
        setSettings(data.settings as AdminSetting[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleValueChange = (id: string, value: string) => {
    setSettings((prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, option_value: value } : s)) : prev
    )
  }

  const applySaved = (setting: AdminSetting) => {
    setSettings((prev) =>
      prev ? prev.map((s) => (s.id === setting.id ? { ...s, ...setting } : s)) : prev
    )
  }

  const postSetting = async (setting: AdminSetting, extra?: { clearSecret?: boolean }) => {
    setSavingId(setting.id)
    setSavedId(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: setting.id,
          value: extra?.clearSecret ? '' : setting.option_value,
          clearSecret: extra?.clearSecret === true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save setting')
      if (data.setting) applySaved(data.setting as AdminSetting)
      setSavedId(setting.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting')
    } finally {
      setSavingId(null)
    }
  }

  const handleSave = async (setting: AdminSetting) => {
    if (setting.option_field_type === 'secret' && !setting.option_value.trim()) return
    await postSetting(setting)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {settings?.map((setting) => (
        <Card key={setting.id}>
          <CardHeader>
            <CardTitle className="text-lg">{setting.option_title}</CardTitle>
            {setting.option_description && (
              <CardDescription>{setting.option_description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                {setting.option_field_type === 'textarea' ? (
                  <Textarea
                    value={setting.option_value}
                    onChange={(e) => handleValueChange(setting.id, e.target.value)}
                    rows={4}
                  />
                ) : setting.option_field_type === 'boolean' ? (
                  <select
                    value={setting.option_value === 'true' ? 'true' : 'false'}
                    onChange={(e) => handleValueChange(setting.id, e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : setting.option_field_type === 'secret' ? (
                  <>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={setting.option_value}
                      placeholder={
                        setting.secret_is_set
                          ? 'A value is saved. Enter a new one to replace it.'
                          : 'No value saved'
                      }
                      onChange={(e) => handleValueChange(setting.id, e.target.value)}
                    />
                    {setting.secret_is_set ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingId === setting.id}
                        onClick={() => postSetting(setting, { clearSecret: true })}
                      >
                        Clear saved value
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Input
                    type={setting.option_field_type === 'email' ? 'email' : 'text'}
                    value={setting.option_value}
                    onChange={(e) => handleValueChange(setting.id, e.target.value)}
                  />
                )}
              </div>
              <Button
                type="button"
                onClick={() => handleSave(setting)}
                disabled={
                  savingId === setting.id ||
                  (setting.option_field_type === 'secret' && !setting.option_value.trim())
                }
              >
                {savingId === setting.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : savedId === setting.id ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingId === setting.id ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
'use client'

// Resume Builder — admin model selector.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { OpenRouterModel } from '../lib/types'

export function ModelSettingsForm() {
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [current, setCurrent] = useState('')
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/resume-builder/api/models')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load models')
        setModels(json.models ?? [])
        setCurrent(json.current ?? '')
        setSelected(json.current ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const saveRes = await fetch('/resume-builder/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selected }),
      })
      const json = await saveRes.json()
      if (!saveRes.ok) throw new Error(json.error || 'Failed to save model')
      setCurrent(selected)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading models…
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        OpenRouter Model
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.id}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Current model: <span className="font-medium">{current}</span>
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-sm text-green-600">Model saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !selected}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Model
      </button>
    </div>
  )
}
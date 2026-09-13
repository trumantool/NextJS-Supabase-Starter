'use client'

// Documents — template picker for creating a new document.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { documentTemplates } from '../lib/templates'
import { Loader2 } from 'lucide-react'

export function TemplatePicker() {
  const router = useRouter()
  const [selected, setSelected] = useState(documentTemplates[0].id)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const template = documentTemplates.find((t) => t.id === selected)!
      const res = await fetch('/documents/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled document',
          template: template.id,
          doc_json: template.doc,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create document')
      router.push(`/documents/${json.document.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document')
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {documentTemplates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={`text-left rounded-lg border-2 p-4 transition-colors ${
              selected === t.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="h-40 rounded border border-gray-200 bg-white p-3 overflow-hidden text-[10px] leading-tight text-gray-600">
              {t.doc.content.slice(0, 6).map((node, i) => {
                const text = node.content
                  ?.map((c) => (c.type === 'text' ? c.text : ''))
                  .join(' ')
                return (
                  <div
                    key={i}
                    className={
                      node.type === 'heading'
                        ? 'font-bold text-gray-900 mb-1'
                        : 'mb-1'
                    }
                  >
                    {text}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 font-medium text-gray-900">{t.name}</div>
            <div className="text-sm text-gray-500">{t.description}</div>
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create document
        </button>
      </div>
    </div>
  )
}

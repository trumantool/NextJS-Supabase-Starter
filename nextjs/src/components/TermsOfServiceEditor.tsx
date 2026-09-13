'use client'

// Terms of Service — TipTap rich-text editor.
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { PrivacyToolbar } from '@/components/PrivacyToolbar'
import { Button } from '@/components/ui/button'
import { Loader2, Save, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useState } from 'react'

interface Props {
  initialContent: string
  onCancel: () => void
  onSaved: (content: string) => void
}

export function TermsOfServiceEditor({ initialContent, onCancel, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px] px-6 py-6',
      },
    },
  })

  const handleSave = async () => {
    if (!editor) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const html = editor.getHTML()
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save Terms of Service')
      }
      setSaved(true)
      onSaved(html)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Terms of Service')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <PrivacyToolbar editor={editor} />

      <div className="bg-gray-50">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          {saved && (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !editor}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
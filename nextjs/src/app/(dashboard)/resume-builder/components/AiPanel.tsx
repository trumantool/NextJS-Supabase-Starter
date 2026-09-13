'use client'

// Resume Builder — AI sidebar that streams from /api/resume-builder/ai.
import { useEffect, useRef, useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import type { ResumeDoc } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  doc: ResumeDoc
  onApply: (text: string) => void
}

const PRESETS = [
  'Write a professional summary for my resume.',
  'Improve the experience section to be more impactful.',
  'Tailor my resume to a software engineering role.',
  'Generate a list of skills for my field.',
]

export function AiPanel({ open, onClose, doc, onApply }: Props) {
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) {
      setOutput('')
      setError(null)
      abortRef.current?.abort()
    }
  }, [open])

  if (!open) return null

  async function run(p: string) {
    if (!p.trim() || streaming) return
    setStreaming(true)
    setError(null)
    setOutput('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/resume-builder/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc, prompt: p }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'AI request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload)
            if (json.delta) setOutput((prev) => prev + json.delta)
            if (json.error) setError(json.error)
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'AI request failed')
      }
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Sparkles className="h-4 w-4 text-violet-600" />
          AI Assistant
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={streaming}
              onClick={() => {
                setPrompt(preset)
                run(preset)
              }}
              className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-md p-2">
            {error}
          </div>
        )}

        {output && (
          <div className="text-sm whitespace-pre-wrap bg-gray-50 rounded-md p-3 text-gray-800">
            {output}
          </div>
        )}

        {streaming && !output && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI to write or improve content…"
          rows={3}
          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={streaming || !prompt.trim()}
            onClick={() => run(prompt)}
            className="flex-1 px-3 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            {streaming ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            disabled={!output || streaming}
            onClick={() => onApply(output)}
            className="flex-1 px-3 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import AutomationForm from '@/components/automations/AutomationForm'
import type { Automation, AutomationRun } from '@/lib/types'

function durationLabel(run: AutomationRun): string {
  if (!run.started_at || !run.finished_at) return '—'
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
  if (ms < 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function isTerminal(status: string) {
  return status === 'succeeded' || status === 'failed' || status === 'skipped'
}

export default function AutomationDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [automation, setAutomation] = useState<(Automation & { cadence?: string }) | null>(null)
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function loadDetail() {
    const response = await fetch(`/api/automations/${id}`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load automation')
    }
    setAutomation(data.automation)
    setRuns(data.runs || [])
  }

  async function loadRuns() {
    const response = await fetch(`/api/automations/${id}/runs`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return
    setRuns(data.runs || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadDetail()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load automation')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // loadDetail is recreated each render; id is the reactive input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const hasInflight = runs.some((r) => r.status === 'queued' || r.status === 'running')

  useEffect(() => {
    if (!hasInflight) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > 2 * 60 * 1000) {
        window.clearInterval(timer)
        return
      }
      void loadRuns()
    }, 2000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hasInflight])

  async function runNow() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/automations/${id}/run`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to enqueue run')
      }
      await loadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enqueue run')
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus() {
    if (!automation) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: automation.status === 'active' ? 'paused' : 'active',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update automation')
      }
      setAutomation(data.automation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update automation')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!automation) return
    if (!window.confirm(`Delete “${automation.name}”? This also deletes its run history.`)) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/automations/${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete automation')
      }
      router.push('/automations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete automation')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-600">Loading automation...</div>
      </div>
    )
  }

  if (!automation) {
    return (
      <div className="w-[95%] mx-auto px-4 py-8">
        <p className="text-gray-700">{error || 'Automation not found.'}</p>
        <Link href="/automations" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Automations
        </Link>
      </div>
    )
  }

  return (
    <div className="w-[95%] mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/automations" className="text-sm text-blue-600 hover:underline">
          ← Automations
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{automation.name}</h1>
            <p className="text-gray-600">{automation.cadence}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runNow}
              disabled={busy || hasInflight}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {busy ? 'Working...' : 'Run now'}
            </button>
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {automation.status === 'active' ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      ) : null}

      <div className="border border-gray-200 rounded-lg p-6 bg-white mb-8">
        <AutomationForm mode="edit" automationId={id} initial={automation} />
      </div>

      <div className="border border-gray-200 rounded-lg p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">Run history</h2>
        <p className="text-sm text-gray-500 mb-4">
          Run now only queues a row. A worker tick (Vercel Cron or a curl with{' '}
          <code>CRON_SECRET</code>) executes it and writes the transcript here.
        </p>
        {runs.length === 0 ? (
          <p className="text-gray-600">No runs yet. Use Run now to test this job.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const open = expanded === run.id
              return (
                <div key={run.id} className="border border-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-800">
                        {new Date(run.created_at).toLocaleString()} · {run.trigger}
                      </span>
                      <span className="text-sm text-gray-600">
                        {run.status}
                        {isTerminal(run.status) ? ` · ${durationLabel(run)}` : ''}
                      </span>
                    </div>
                    {run.error ? (
                      <p className="text-sm text-red-700 mt-1 line-clamp-2">{run.error}</p>
                    ) : null}
                  </button>
                  {open ? (
                    <div className="px-4 pb-4 prose prose-sm max-w-none">
                      {run.output ? (
                        <ReactMarkdown>{run.output}</ReactMarkdown>
                      ) : (
                        <p className="text-gray-500">No output yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

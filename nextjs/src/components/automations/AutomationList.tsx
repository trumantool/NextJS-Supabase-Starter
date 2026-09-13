'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LastRun = {
  id: string
  status: string
  trigger: string
  created_at: string
  finished_at: string | null
  error: string | null
}

type AutomationRow = {
  id: string
  name: string
  status: string
  cadence: string
  lastRun: LastRun | null
  hasInflight: boolean
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function AutomationList() {
  const [automations, setAutomations] = useState<AutomationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/automations', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load automations')
    }
    setAutomations(data.automations || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load automations')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function runNow(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/automations/${id}/run`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to enqueue run')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enqueue run')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleStatus(row: AutomationRow) {
    setBusyId(row.id)
    setError(null)
    try {
      const next = row.status === 'active' ? 'paused' : 'active'
      const response = await fetch(`/api/automations/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update automation')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update automation')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(row: AutomationRow) {
    if (!window.confirm(`Delete “${row.name}”? This also deletes its run history.`)) {
      return
    }
    setBusyId(row.id)
    setError(null)
    try {
      const response = await fetch(`/api/automations/${row.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete automation')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete automation')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-600">Loading automations...</div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <h1 className="text-3xl font-bold mb-2">Automations</h1>
          <p className="text-gray-600">
            Describe a job once. The assistant runs it on a schedule with OpenRouter and any
            attached skills. No external integrations required.
          </p>
        </div>
        <Link
          href="/automations/new"
          className="order-first w-full sm:order-none sm:w-auto shrink-0 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Automation
        </Link>
      </div>

      {error ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      ) : null}

      {automations.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-10 bg-white text-center">
          <p className="text-gray-700 mb-4">
            No automations yet. Create one to run a prompt on a schedule.
          </p>
          <Link
            href="/automations/new"
            className="inline-flex w-full sm:w-auto items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Automation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map((row) => (
            <div key={row.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/automations/${row.id}`} className="text-xl font-semibold hover:underline">
                    {row.name}
                  </Link>
                  <p className="text-gray-600 mt-1">{row.cadence}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Last run:{' '}
                    {row.lastRun
                      ? `${row.lastRun.status} · ${formatRelative(row.lastRun.finished_at || row.lastRun.created_at)}`
                      : 'Never'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      row.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {row.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  <button
                    type="button"
                    onClick={() => runNow(row.id)}
                    disabled={busyId === row.id || row.hasInflight}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {busyId === row.id ? 'Working...' : 'Run now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatus(row)}
                    disabled={busyId === row.id}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100"
                  >
                    {row.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <Link
                    href={`/automations/${row.id}`}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busyId === row.id}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:bg-gray-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

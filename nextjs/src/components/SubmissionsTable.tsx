'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Phone, CalendarDays, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import type { Tables } from '@/lib/types'

type ContactSubmission = Tables<'contact_submissions'>

const STATUS_OPTIONS = ['new', 'in_progress', 'resolved', 'closed'] as const

// Badge color per status
const statusStyles: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-600',
}

interface Props {
  initialSubmissions: ContactSubmission[]
}

export function SubmissionsTable({ initialSubmissions }: Props) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>(initialSubmissions)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = async (id: string, status: string) => {
    setSavingId(id)
    setError(null)
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to update status')
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? (data.submission as ContactSubmission) : s))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSavingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">No submissions yet</p>
            <p className="mt-1 text-sm">
              Messages sent through the contact form will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        submissions.map((submission) => (
          <Card key={submission.id} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {submission.first_name} {submission.last_name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[submission.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {submission.status}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <a
                        href={`mailto:${submission.email_address}`}
                        className="text-primary-600 hover:underline"
                      >
                        {submission.email_address}
                      </a>
                    </p>
                    {submission.phone_number && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {submission.phone_number}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                      {formatDate(submission.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 sr-only">Status</label>
                  <select
                    value={submission.status}
                    disabled={savingId === submission.id}
                    onChange={(e) => handleStatusChange(submission.id, e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-primary-500 disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {savingId === submission.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {submission.message}
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <ExternalLink className="h-3.5 w-3.5" />
                Source: {submission.source}
                {submission.user_id ? ' · Authenticated user' : ' · Anonymous'}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
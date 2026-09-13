'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Loader2, FileText, Calendar } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tables } from '@/lib/types'

type TextAssessment = Tables<'text_assessments'>

export function MyAssessments({ assessments }: { assessments: TextAssessment[] }) {
  const router = useRouter()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const startRename = (assessment: TextAssessment) => {
    setRenamingId(assessment.id)
    setDraftName(assessment.name)
    setError(null)
  }

  const handleRename = async (assessmentId: string) => {
    setError(null)
    setPendingRenameId(assessmentId)
    try {
      const res = await fetch(`/my-assessments/api/assessments/${assessmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draftName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to rename assessment')
      }
      setRenamingId(null)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename assessment')
    } finally {
      setPendingRenameId(null)
    }
  }

  const handleDelete = async (assessmentId: string) => {
    setError(null)
    setPendingDeleteId(assessmentId)
    try {
      const res = await fetch(`/my-assessments/api/assessments/${assessmentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete assessment')
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assessment')
    } finally {
      setPendingDeleteId(null)
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Assessments</h1>
          <p className="mt-1 text-sm text-gray-500">
            All your intake assessments. You can rename or delete any of them.
          </p>
        </div>
        <Button asChild>
          <Link href="/audio-text-assessment">Create Assessment</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {assessments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No assessments yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            You haven&apos;t created any intake assessments yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {assessments.map((assessment) => {
            const isRenaming = renamingId === assessment.id
            return (
              <li
                key={assessment.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(assessment.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        autoFocus
                        className="max-w-sm"
                        aria-label="Assessment name"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRename(assessment.id)}
                          disabled={pendingRenameId === assessment.id}
                        >
                          {pendingRenameId === assessment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenamingId(null)}
                          disabled={pendingRenameId === assessment.id}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900">{assessment.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        Created {formatDate(assessment.created_at)}
                      </p>
                    </>
                  )}
                </div>

                {!isRenaming && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startRename(assessment)}
                    >
                      <Pencil className="h-4 w-4" />
                      Rename
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{assessment.name}&quot; and all of its answers will be
                            permanently deleted. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault()
                              handleDelete(assessment.id)
                            }}
                            disabled={pendingDeleteId === assessment.id}
                          >
                            {pendingDeleteId === assessment.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

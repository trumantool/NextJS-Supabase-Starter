'use client'

// Resume Builder — delete button with confirmation.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteResumeButton({ id }: { id: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this resume? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/resume-builder/api/resumes/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Failed to delete')
      }
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      title="Delete"
      className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  )
}
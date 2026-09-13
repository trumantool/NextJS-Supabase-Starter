'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client'
import { loadSkillFileText, prepareSkillPreviewBody } from '@/lib/agent-skills'
import type { AgentSkillRow } from './actions'

export function SkillPreviewDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: AgentSkillRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !skill) return
    let cancelled = false
    setLoading(true)
    setError('')
    setBody('')
    void (async () => {
      try {
        const supabase = await createSPASassClient()
        const text = await loadSkillFileText(skill.skill_url, (key, expires) =>
          supabase.signAgentSkillUrl(key, expires ?? 60)
        )
        if (!cancelled) setBody(prepareSkillPreviewBody(text))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load skill')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, skill])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{skill?.skill_name ?? 'Skill'}</DialogTitle>
          <DialogDescription>
            {skill?.skill_description || 'Read-only preview of the skill markdown.'}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {body ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

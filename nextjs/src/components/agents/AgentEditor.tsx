'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SkillPicker } from '@/components/agents/SkillPicker'
import { DEFAULT_AGENT_MODEL, modelIdFromDefaults } from '@/lib/agent-templates'
import type { AgentSkillListItem } from '@/app/api/agent-skills/route'
import type { UserAgent } from '@/lib/types'

export default function AgentEditor({ agentId }: { agentId: string }) {
  const router = useRouter()
  const [agent, setAgent] = useState<UserAgent | null>(null)
  const [skills, setSkills] = useState<AgentSkillListItem[]>([])
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelId, setModelId] = useState(DEFAULT_AGENT_MODEL)
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    void load()
  }, [agentId])

  const load = async () => {
    try {
      setLoading(true)
      const [agentRes, skillsRes] = await Promise.all([
        fetch(`/api/agents/${agentId}`, { cache: 'no-store' }),
        fetch('/api/agent-skills', { cache: 'no-store' }),
      ])
      const agentJson = (await agentRes.json()) as { agent?: UserAgent; error?: string }
      const skillsJson = (await skillsRes.json()) as { skills?: AgentSkillListItem[]; error?: string }
      if (!agentRes.ok || !agentJson.agent) {
        throw new Error(agentJson.error || 'Agent not found')
      }
      if (!skillsRes.ok) {
        throw new Error(skillsJson.error || 'Failed to load skills')
      }
      setAgent(agentJson.agent)
      setName(agentJson.agent.name)
      setSystemPrompt(agentJson.agent.system_prompt)
      setModelId(modelIdFromDefaults(agentJson.agent.defaults))
      setSkillIds(agentJson.agent.skill_ids || [])
      setSkills(skillsJson.skills || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    try {
      setSaving(true)
      setError('')
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          system_prompt: systemPrompt,
          skill_ids: skillIds,
          model_id: modelId,
        }),
      })
      const json = (await res.json()) as { agent?: UserAgent; error?: string }
      if (!res.ok || !json.agent) throw new Error(json.error || 'Failed to save')
      setAgent(json.agent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to delete')
      router.push('/agents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Agent not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/agents">Back to agents</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/agents" className="text-sm text-blue-600 hover:underline">
          ← Agents
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit agent</h1>
        <p className="text-sm text-gray-500">
          {agent.source_template_name
            ? `Cloned from ${agent.source_template_name}.`
            : 'Custom agent.'}{' '}
          Chat with this agent arrives in Phase 5.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">OpenRouter model</span>
          <Input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder={DEFAULT_AGENT_MODEL}
          />
          <span className="text-xs text-gray-500">
            Stored on the agent as <code>defaults.model_id</code>.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">System prompt</span>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            maxLength={8000}
          />
        </label>
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Skills</span>
          <SkillPicker skills={skills} selected={skillIds} onChange={setSkillIds} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/agent-skills">Manage skills</Link>
        </Button>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
          Delete
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the agent and its agent-memory folder. Chat threads that point at it
              will cascade when Chat ships.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

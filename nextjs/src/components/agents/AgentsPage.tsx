'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Loader2, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { modelIdFromDefaults } from '@/lib/agent-templates'
import type { UserAgent } from '@/lib/types'

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<UserAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/agents', { cache: 'no-store' })
      const json = (await res.json()) as { agents?: UserAgent[]; error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to load agents')
      setAgents(json.agents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const createBlank = async () => {
    try {
      setCreating(true)
      setError('')
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled agent' }),
      })
      const json = (await res.json()) as { agent?: UserAgent; error?: string }
      if (!res.ok || !json.agent) throw new Error(json.error || 'Failed to create agent')
      router.push(`/agents/${json.agent.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500">
            Your OpenRouter agents. Attach skills, then open Chat and switch to an agent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/agent-templates">Browse templates</Link>
          </Button>
          <Button onClick={() => void createBlank()} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : 'New agent'}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No agents yet</CardTitle>
            <CardDescription>
              Clone the Starter Assistant, or create a blank agent and attach skills.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/agent-templates">Use a template</Link>
            </Button>
            <Button variant="outline" onClick={() => void createBlank()} disabled={creating}>
              Create blank
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900 truncate">{agent.name}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {agent.source_template_name
                  ? `From ${agent.source_template_name}`
                  : 'Custom'}
                {' · '}
                {agent.skill_ids.length} skill{agent.skill_ids.length === 1 ? '' : 's'}
                {' · '}
                {modelIdFromDefaults(agent.defaults)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

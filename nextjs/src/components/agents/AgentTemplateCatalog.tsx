'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { modelIdFromDefaults, STARTER_TEMPLATE_SLUG } from '@/lib/agent-templates'
import type { CatalogTemplate } from '@/lib/agent-templates'
import type { UserAgent } from '@/lib/types'

export default function AgentTemplateCatalog() {
  const router = useRouter()
  const [templates, setTemplates] = useState<CatalogTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cloningId, setCloningId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/agent-templates', { cache: 'no-store' })
      const json = (await res.json()) as { templates?: CatalogTemplate[]; error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to load templates')
      setTemplates((json.templates || []).filter((t) => t.status === 'published'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const clone = async (template: CatalogTemplate) => {
    try {
      setCloningId(template.id)
      setError('')
      const body = template.builtin || template.slug === STARTER_TEMPLATE_SLUG
        ? { starter: true, name: template.name }
        : { template_id: template.id, name: template.name }
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { agent?: UserAgent; error?: string }
      if (!res.ok || !json.agent) throw new Error(json.error || 'Failed to clone template')
      router.push(`/agents/${json.agent.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone template')
      setCloningId(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Templates</h1>
        <p className="text-sm text-gray-500">
          Published recipes you can clone into your account. Admins manage the catalog.
        </p>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription>
                  {template.description || 'No description.'}
                  {template.builtin ? ' (built-in starter)' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">
                  {template.skill_ids.length} shared skill
                  {template.skill_ids.length === 1 ? '' : 's'}
                  {' · '}
                  {modelIdFromDefaults(template.defaults)}
                </p>
                <Button
                  onClick={() => void clone(template)}
                  disabled={cloningId === template.id}
                >
                  {cloningId === template.id ? 'Cloning…' : 'Use this template'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

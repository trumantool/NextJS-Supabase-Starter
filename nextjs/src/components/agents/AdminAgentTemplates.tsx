'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SkillPicker } from '@/components/agents/SkillPicker'
import {
  DEFAULT_AGENT_MODEL,
  modelIdFromDefaults,
  slugifyName,
  STARTER_TEMPLATE_SLUG,
  type CatalogTemplate,
} from '@/lib/agent-templates'
import type { AgentSkillListItem } from '@/app/api/agent-skills/route'
import type { AgentTemplate } from '@/lib/types'

type Draft = {
  name: string
  slug: string
  description: string
  status: 'draft' | 'published'
  system_prompt: string
  skill_ids: string[]
  model_id: string
}

const emptyDraft = (): Draft => ({
  name: '',
  slug: '',
  description: '',
  status: 'draft',
  system_prompt: '',
  skill_ids: [],
  model_id: DEFAULT_AGENT_MODEL,
})

function toDraft(template: AgentTemplate): Draft {
  return {
    name: template.name,
    slug: template.slug,
    description: template.description || '',
    status: template.status === 'published' ? 'published' : 'draft',
    system_prompt: template.system_prompt,
    skill_ids: template.skill_ids || [],
    model_id: modelIdFromDefaults(template.defaults),
  }
}

export default function AdminAgentTemplates() {
  const [templates, setTemplates] = useState<CatalogTemplate[]>([])
  const [skills, setSkills] = useState<AgentSkillListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [tplRes, skillRes] = await Promise.all([
        fetch('/api/agent-templates?status=all', { cache: 'no-store' }),
        fetch('/api/agent-skills', { cache: 'no-store' }),
      ])
      const tplJson = (await tplRes.json()) as { templates?: CatalogTemplate[]; error?: string }
      const skillJson = (await skillRes.json()) as { skills?: AgentSkillListItem[]; error?: string }
      if (!tplRes.ok) throw new Error(tplJson.error || 'Failed to load templates')
      if (!skillRes.ok) throw new Error(skillJson.error || 'Failed to load skills')
      setTemplates(tplJson.templates || [])
      setSkills(skillJson.skills || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const select = (template: CatalogTemplate | 'new') => {
    setError('')
    setMessage('')
    if (template === 'new') {
      setSelectedId('new')
      setDraft(emptyDraft())
      return
    }
    setSelectedId(template.id)
    setDraft(toDraft(template))
  }

  const persist = async () => {
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const payload = {
        name: draft.name,
        slug: draft.slug || slugifyName(draft.name),
        description: draft.description,
        status: draft.status,
        system_prompt: draft.system_prompt,
        skill_ids: draft.skill_ids,
        model_id: draft.model_id,
      }

      const isNew = selectedId === 'new' || selectedId === STARTER_TEMPLATE_SLUG
      const res = isNew
        ? await fetch('/api/admin/agent-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              selectedId === STARTER_TEMPLATE_SLUG ? { starter: true } : payload
            ),
          })
        : await fetch(`/api/admin/agent-templates/${selectedId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = (await res.json()) as { template?: AgentTemplate; error?: string }
      if (!res.ok || !json.template) throw new Error(json.error || 'Failed to save template')
      setMessage('Template saved.')
      setSelectedId(json.template.id)
      setDraft(toDraft(json.template))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const publishStarter = async () => {
    try {
      setSaving(true)
      setError('')
      const res = await fetch('/api/admin/agent-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starter: true }),
      })
      const json = (await res.json()) as { template?: AgentTemplate; error?: string }
      if (!res.ok || !json.template) throw new Error(json.error || 'Failed to publish starter')
      setMessage('Starter Assistant published.')
      setSelectedId(json.template.id)
      setDraft(toDraft(json.template))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish starter')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!selectedId || selectedId === 'new' || selectedId === STARTER_TEMPLATE_SLUG) return
    try {
      setSaving(true)
      setError('')
      const res = await fetch(`/api/admin/agent-templates/${selectedId}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to delete')
      setSelectedId(null)
      setDraft(emptyDraft())
      setMessage('Template deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const hasPersistedStarter = templates.some(
    (t) => t.slug === STARTER_TEMPLATE_SLUG && !t.builtin
  )

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Catalog recipes users can clone. Templates may only attach shared skills. Leave
        toolkits empty — v1 is OpenRouter + skills only.
      </p>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => select('new')}>
          New template
        </Button>
        {hasPersistedStarter ? null : (
          <Button variant="outline" onClick={() => void publishStarter()} disabled={saving}>
            Publish Starter Assistant
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ul className="space-y-1">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => select(template)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm ${
                  selectedId === template.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="block font-medium">{template.name}</span>
                <span className="text-xs text-gray-500">
                  {template.builtin ? 'built-in' : template.status}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selectedId ? (
          <div className="space-y-4">
            {selectedId === STARTER_TEMPLATE_SLUG ? (
              <p className="text-sm text-gray-500">
                This is the in-code starter. Publish it to store a row you can edit.
              </p>
            ) : null}
            <label className="block space-y-1">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: prev.slug || slugifyName(e.target.value),
                  }))
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Slug</span>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Description</span>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Status</span>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.status}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    status: e.target.value === 'published' ? 'published' : 'draft',
                  }))
                }
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">OpenRouter model</span>
              <Input
                value={draft.model_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, model_id: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">System prompt</span>
              <Textarea
                value={draft.system_prompt}
                onChange={(e) => setDraft((prev) => ({ ...prev, system_prompt: e.target.value }))}
                rows={8}
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm font-medium">Shared skills</span>
              <SkillPicker
                skills={skills}
                selected={draft.skill_ids}
                onChange={(skill_ids) => setDraft((prev) => ({ ...prev, skill_ids }))}
                sharedOnly
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void persist()} disabled={saving}>
                {saving ? 'Saving…' : selectedId === 'new' || selectedId === STARTER_TEMPLATE_SLUG
                  ? 'Create'
                  : 'Save'}
              </Button>
              {selectedId !== 'new' && selectedId !== STARTER_TEMPLATE_SLUG ? (
                <Button variant="destructive" onClick={() => void remove()} disabled={saving}>
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a template or create a new one.</p>
        )}
      </div>
    </div>
  )
}

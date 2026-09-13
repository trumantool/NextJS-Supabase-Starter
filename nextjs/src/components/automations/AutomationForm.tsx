'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SkillPicker } from '@/components/agents/SkillPicker'
import type { AgentSkillListItem } from '@/app/api/agent-skills/route'
import { DEFAULT_AGENT_MODEL, MAX_TEMPLATE_SKILLS } from '@/lib/agent-templates'
import {
  COMMON_TIMEZONES,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  type AutomationFrequency,
} from '@/lib/automation-schedule'
import type { Automation } from '@/lib/types'

type AutomationFormProps = {
  mode: 'create' | 'edit'
  automationId?: string
  initial?: Partial<Automation>
}

export default function AutomationForm({ mode, automationId, initial }: AutomationFormProps) {
  const router = useRouter()
  const browserZone =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'

  const [name, setName] = useState(initial?.name ?? '')
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')
  const [frequency, setFrequency] = useState<AutomationFrequency>(
    (initial?.frequency as AutomationFrequency) || 'daily'
  )
  const [localTime, setLocalTime] = useState(() => {
    const t = initial?.local_time || '08:00:00'
    return t.slice(0, 5)
  })
  const [timezone, setTimezone] = useState(initial?.timezone || browserZone)
  const [weekday, setWeekday] = useState(initial?.weekday ?? 0)
  const [monthday, setMonthday] = useState(initial?.monthday ?? 1)
  const [month, setMonth] = useState(initial?.month ?? 1)
  const [onceOn, setOnceOn] = useState(initial?.once_on ?? '')
  const [allowMutations, setAllowMutations] = useState(initial?.allow_mutations ?? false)
  const [modelId, setModelId] = useState(initial?.model_id || DEFAULT_AGENT_MODEL)
  const [skillIds, setSkillIds] = useState<string[]>(() =>
    Array.isArray(initial?.skill_ids) ? [...initial.skill_ids] : []
  )
  const [skills, setSkills] = useState<AgentSkillListItem[]>([])
  const [agentId, setAgentId] = useState<string>(initial?.agent_id || '')
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timezones = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES)
    if (timezone) set.add(timezone)
    if (browserZone) set.add(browserZone)
    return [...set]
  }, [timezone, browserZone])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [agentsRes, skillsRes] = await Promise.all([
          fetch('/api/agents', { cache: 'no-store' }),
          fetch('/api/agent-skills', { cache: 'no-store' }),
        ])
        const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] }
        const skillsData = skillsRes.ok ? await skillsRes.json() : { skills: [] }
        if (cancelled) return
        setAgents(
          (agentsData.agents || []).map((row: { id: string; name: string }) => ({
            id: row.id,
            name: row.name,
          }))
        )
        setSkills(skillsData.skills || [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load agents and skills')
        }
      } finally {
        if (!cancelled) setLoadingExtras(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function onSkillChange(ids: string[]) {
    if (ids.length > MAX_TEMPLATE_SKILLS) {
      setError(`Select at most ${MAX_TEMPLATE_SKILLS} skills.`)
      return
    }
    setSkillIds(ids)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name,
        prompt,
        frequency,
        timezone,
        local_time: localTime,
        weekday: frequency === 'weekly' ? weekday : null,
        monthday: frequency === 'monthly' || frequency === 'yearly' ? monthday : null,
        month: frequency === 'yearly' ? month : null,
        once_on: frequency === 'once' ? onceOn : null,
        allow_mutations: allowMutations,
        model_id: modelId,
        skill_ids: skillIds,
        agent_id: agentId || null,
      }

      const url = mode === 'create' ? '/api/automations' : `/api/automations/${automationId}`
      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save automation')
      }
      const id = data.automation?.id || automationId
      router.push(`/automations/${id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save automation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-name">
          Name
        </label>
        <input
          id="auto-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Morning brief"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-prompt">
          Instructions
        </label>
        <textarea
          id="auto-prompt"
          required
          maxLength={8000}
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Example: Every morning, summarize yesterday’s open tasks and suggest the first three things to do."
        />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <h2 className="text-lg font-semibold">Schedule</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-freq">
              Frequency
            </label>
            <select
              id="auto-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as AutomationFrequency)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-time">
              Time
            </label>
            <input
              id="auto-time"
              type="time"
              required
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-tz">
              Timezone
            </label>
            <select
              id="auto-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {frequency === 'weekly' ? (
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Day of week</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_NAMES.map((label, index) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="weekday"
                    checked={weekday === index}
                    onChange={() => setWeekday(index)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {frequency === 'monthly' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-monthday">
              Day of month
            </label>
            <input
              id="auto-monthday"
              type="number"
              min={1}
              max={31}
              value={monthday}
              onChange={(e) => setMonthday(Number(e.target.value))}
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              If the month is shorter, the job runs on the last day of that month.
            </p>
          </div>
        ) : null}

        {frequency === 'yearly' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-month">
                Month
              </label>
              <select
                id="auto-month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {MONTH_NAMES.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-yearday">
                Day
              </label>
              <input
                id="auto-yearday"
                type="number"
                min={1}
                max={31}
                value={monthday}
                onChange={(e) => setMonthday(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        ) : null}

        {frequency === 'once' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-once">
              Date
            </label>
            <input
              id="auto-once"
              type="date"
              required
              value={onceOn}
              onChange={(e) => setOnceOn(e.target.value)}
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-agent">
          Run as agent
        </label>
        <select
          id="auto-agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">None (default assistant)</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-500 mt-1">
          Optional. The run prepends that agent’s prompt and merges its skills with the ones
          selected below.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-700">Skills</span>
        {loadingExtras ? (
          <p className="text-sm text-gray-500">Loading skills…</p>
        ) : (
          <SkillPicker skills={skills} selected={skillIds} onChange={onSkillChange} />
        )}
        <p className="text-sm text-gray-500">
          Skill markdown is injected as system context. At most {MAX_TEMPLATE_SKILLS} skills.
        </p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={allowMutations}
          onChange={(e) => setAllowMutations(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium text-gray-900">Allow write actions (future)</span>
          <span className="block text-sm text-gray-600">
            Stored as <code>allow_mutations</code> and defaults off. v1 has no tool loop, so this
            flag does not call external integrations.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="auto-model">
          OpenRouter model
        </label>
        <input
          id="auto-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2"
          placeholder={DEFAULT_AGENT_MODEL}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <Link
          href="/automations"
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

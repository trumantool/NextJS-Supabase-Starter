'use client'

import { builtinKeyFromDefaults } from '@/lib/starter-catalog-allowlist'
import type { UserAgent } from '@/lib/types'

type AgentSwitcherProps = {
  id?: string
  agents: UserAgent[]
  value: string | null
  disabled?: boolean
  onChange: (agentId: string | null) => void
}

export const PLAIN_GENERAL_VALUE = ''
export const GENERAL_AGENT_VALUE = 'builtin:general'
export const TASK_MANAGEMENT_VALUE = 'builtin:task-management'

export function switcherValueForAgent(agentId: string | null, agents: UserAgent[]): string {
  if (!agentId) return PLAIN_GENERAL_VALUE
  const agent = agents.find((item) => item.id === agentId)
  const key = agent ? builtinKeyFromDefaults(agent.defaults) : null
  if (key === 'general') return GENERAL_AGENT_VALUE
  if (key === 'task-management') return TASK_MANAGEMENT_VALUE
  return agentId
}

export default function AgentSwitcher({
  id,
  agents,
  value,
  disabled,
  onChange,
}: AgentSwitcherProps) {
  const others = agents.filter((agent) => !builtinKeyFromDefaults(agent.defaults))
  const selected = switcherValueForAgent(value, agents)

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className="sr-only">Agent</span>
      <select
        id={id}
        value={selected}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
      >
        <option value={PLAIN_GENERAL_VALUE}>General</option>
        <option value={GENERAL_AGENT_VALUE}>General agent</option>
        <option value={TASK_MANAGEMENT_VALUE}>Task Management</option>
        {others.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </label>
  )
}

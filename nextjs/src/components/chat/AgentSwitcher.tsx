'use client'

import type { UserAgent } from '@/lib/types'

type AgentSwitcherProps = {
  id?: string
  agents: UserAgent[]
  value: string | null
  disabled?: boolean
  onChange: (agentId: string | null) => void
}

export default function AgentSwitcher({
  id,
  agents,
  value,
  disabled,
  onChange,
}: AgentSwitcherProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className="sr-only">Agent</span>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
      >
        <option value="">General</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </label>
  )
}

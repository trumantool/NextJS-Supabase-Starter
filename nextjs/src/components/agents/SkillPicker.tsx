'use client'

import type { AgentSkillListItem } from '@/app/api/agent-skills/route'

export function SkillPicker({
  skills,
  selected,
  onChange,
  sharedOnly = false,
}: {
  skills: AgentSkillListItem[]
  selected: string[]
  onChange: (ids: string[]) => void
  sharedOnly?: boolean
}) {
  const visible = (sharedOnly ? skills.filter((s) => s.user_id === null) : skills.filter((s) => s.user_id !== null))
  const selectedSet = new Set(selected)

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {sharedOnly
          ? 'Shared catalog skills are hidden.'
          : 'No personal skills yet. Upload one in Skills, then attach it here. Built-in Task Management files stay on that agent and are not listed here.'}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {visible.map((skill) => {
        const checked = selectedSet.has(skill.id)
        return (
          <li key={skill.id}>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={() => {
                  onChange(
                    checked ? selected.filter((id) => id !== skill.id) : [...selected, skill.id]
                  )
                }}
              />
              <span>
                <span className="font-medium text-gray-900">{skill.skill_name}</span>
                <span className="ml-2 text-xs text-gray-400">Mine</span>
                {skill.skill_description ? (
                  <span className="block text-gray-500">{skill.skill_description}</span>
                ) : null}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

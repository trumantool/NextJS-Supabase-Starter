import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TASK_MANAGEMENT_SKILLS } from '@/lib/builtin-agents'
import { buildLoadedSkillsPrompt, type SkillPromptPart } from '@/lib/load-agent-skills'

function readListTasks() {
  return readFileSync(join(process.cwd(), 'src/lib/builtin-skills/task-management/list-tasks.md'), 'utf8')
}
function readCreateTask() {
  return readFileSync(join(process.cwd(), 'src/lib/builtin-skills/task-management/create-task.md'), 'utf8')
}
function readCompleteTask() {
  return readFileSync(join(process.cwd(), 'src/lib/builtin-skills/task-management/complete-task.md'), 'utf8')
}
function readDeleteTask() {
  return readFileSync(join(process.cwd(), 'src/lib/builtin-skills/task-management/delete-task.md'), 'utf8')
}

const READERS: Record<string, () => string> = {
  'list-tasks': readListTasks,
  'create-task': readCreateTask,
  'complete-task': readCompleteTask,
  'delete-task': readDeleteTask,
}

export function readBuiltinSkillMarkdown(slug: string): string | null {
  const read = READERS[slug]
  if (!read) return null
  try {
    return read()
  } catch (err) {
    console.error('readBuiltinSkillMarkdown:', slug, err)
    return null
  }
}

/** Always-on Task Management instructions. These are not agent_skills rows. */
export function taskManagementSkillPrompt(): string {
  const parts: SkillPromptPart[] = []
  for (const skill of TASK_MANAGEMENT_SKILLS) {
    const body = readBuiltinSkillMarkdown(skill.slug)
    if (!body) continue
    parts.push({ name: skill.name, body: body.trim() })
  }
  return buildLoadedSkillsPrompt(parts)
}

export const TASK_TOOL_NAMES = ['list_tasks', 'create_task', 'complete_task', 'delete_task'] as const

export type TaskToolName = (typeof TASK_TOOL_NAMES)[number]

export function isTaskToolName(value: unknown): value is TaskToolName {
  return typeof value === 'string' && (TASK_TOOL_NAMES as readonly string[]).includes(value)
}

export function parseTaskId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseTaskToolRequest(body: unknown):
  | { name: TaskToolName; arguments: Record<string, unknown> }
  | { error: string } {
  const record = asRecord(body)
  if (!record) return { error: 'Request body must be an object.' }

  let name: unknown
  let args: unknown

  if (record.method === 'tools/call') {
    const params = asRecord(record.params)
    name = params?.name
    args = params?.arguments ?? {}
  } else {
    name = record.tool ?? record.name
    args = record.arguments ?? record.args ?? {}
  }

  if (!isTaskToolName(name)) {
    return { error: 'Tool must be list_tasks, create_task, complete_task, or delete_task.' }
  }
  const parsedArgs = asRecord(args)
  if (!parsedArgs) return { error: 'Tool arguments must be an object.' }
  return { name, arguments: parsedArgs }
}

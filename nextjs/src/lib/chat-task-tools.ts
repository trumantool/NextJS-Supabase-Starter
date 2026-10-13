import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOpenRouterKey } from '@/lib/byok'
import type { OpenRouterUsage } from '@/app/(dashboard)/documents/lib/openrouter'
import {
  isTaskToolName,
  parseTaskId,
  type TaskToolName,
} from '@/lib/chat-task-protocol'

export { isTaskToolName, parseTaskId, parseTaskToolRequest, TASK_TOOL_NAMES } from '@/lib/chat-task-protocol'
export type { TaskToolName } from '@/lib/chat-task-protocol'

export type TaskToolResult =
  | { ok: true; tasks?: TaskRow[]; task?: TaskRow; deletedId?: number }
  | { ok: false; error: string }

export type TaskRow = {
  id: number
  title: string
  urgent: boolean
  description: string | null
  done: boolean
  done_at: string | null
  created_at: string
}

const TITLE_MAX = 500
const DESCRIPTION_MAX = 5000

function mapTask(row: {
  id: number
  title: string
  urgent: boolean
  description: string | null
  done: boolean
  done_at: string | null
  created_at: string
}): TaskRow {
  return {
    id: row.id,
    title: row.title,
    urgent: row.urgent,
    description: row.description,
    done: row.done,
    done_at: row.done_at,
    created_at: row.created_at,
  }
}

export async function listTasks(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown> = {}
): Promise<TaskToolResult> {
  let query = supabase
    .from('todo_list')
    .select('id, title, urgent, description, done, done_at, created_at')
    .eq('owner', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (typeof args.done === 'boolean') {
    query = query.eq('done', args.done)
  }

  const { data, error } = await query
  if (error) {
    console.error('listTasks:', error)
    return { ok: false, error: 'Failed to list tasks.' }
  }
  return { ok: true, tasks: (data || []).map(mapTask) }
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<TaskToolResult> {
  if (typeof args.title !== 'string' || args.title.trim().length < 1 || args.title.trim().length > TITLE_MAX) {
    return { ok: false, error: `title is required (1–${TITLE_MAX} characters).` }
  }
  let description: string | null = null
  if (args.description !== undefined && args.description !== null) {
    if (typeof args.description !== 'string' || args.description.length > DESCRIPTION_MAX) {
      return { ok: false, error: `description must be text up to ${DESCRIPTION_MAX} characters.` }
    }
    description = args.description.trim() || null
  }
  const urgent = args.urgent === undefined ? false : args.urgent === true
  if (args.urgent !== undefined && typeof args.urgent !== 'boolean') {
    return { ok: false, error: 'urgent must be a boolean.' }
  }

  const { data, error } = await supabase
    .from('todo_list')
    .insert({
      title: args.title.trim(),
      description,
      urgent,
      done: false,
      owner: userId,
    })
    .select('id, title, urgent, description, done, done_at, created_at')
    .single()

  if (error || !data) {
    console.error('createTask:', error)
    return { ok: false, error: 'Failed to create task.' }
  }
  return { ok: true, task: mapTask(data) }
}

export async function completeTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<TaskToolResult> {
  const id = parseTaskId(args.id)
  if (!id) return { ok: false, error: 'id must be a positive integer.' }

  const { data, error } = await supabase
    .from('todo_list')
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner', userId)
    .select('id, title, urgent, description, done, done_at, created_at')
    .maybeSingle()

  if (error) {
    console.error('completeTask:', error)
    return { ok: false, error: 'Failed to complete task.' }
  }
  if (!data) return { ok: false, error: 'Task not found.' }
  return { ok: true, task: mapTask(data) }
}

export async function deleteTask(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<TaskToolResult> {
  const id = parseTaskId(args.id)
  if (!id) return { ok: false, error: 'id must be a positive integer.' }

  const { data, error } = await supabase
    .from('todo_list')
    .delete()
    .eq('id', id)
    .eq('owner', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('deleteTask:', error)
    return { ok: false, error: 'Failed to delete task.' }
  }
  if (!data) return { ok: false, error: 'Task not found.' }
  return { ok: true, deletedId: id }
}

export async function runTaskTool(
  supabase: SupabaseClient,
  userId: string,
  name: TaskToolName,
  args: Record<string, unknown>
): Promise<TaskToolResult> {
  switch (name) {
    case 'list_tasks':
      return listTasks(supabase, userId, args)
    case 'create_task':
      return createTask(supabase, userId, args)
    case 'complete_task':
      return completeTask(supabase, userId, args)
    case 'delete_task':
      return deleteTask(supabase, userId, args)
  }
}

export const TASK_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List the signed-in user\'s to-do rows. Optional done filter.',
      parameters: {
        type: 'object',
        properties: {
          done: { type: 'boolean', description: 'When set, return only rows with this done value.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a to-do for the signed-in user.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          urgent: { type: 'boolean' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark one owned to-do done and set done_at. No reopen.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete one owned to-do by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  },
] as const

type ModelMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
    return {}
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

/**
 * Non-streaming tool loop, then the final assistant text. Falls back to a
 * single completion without tools when the model rejects the tool payload.
 */
export async function completeWithTaskTools(opts: {
  supabase: SupabaseClient
  userId: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  onChunk: (delta: string) => void
}): Promise<{ text: string; usage: OpenRouterUsage }> {
  const key = await resolveOpenRouterKey(opts.userId)
  const messages: ModelMessage[] = opts.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
  const usage: OpenRouterUsage = { inputTokens: 0, outputTokens: 0 }

  for (let round = 0; round < 4; round++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        tools: TASK_TOOL_DEFINITIONS,
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenRouter task tools request failed: ${res.status} ${text}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown
          tool_calls?: Array<{
            id?: string
            type?: string
            function?: { name?: string; arguments?: unknown }
          }>
        }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        input_tokens?: number
        output_tokens?: number
      }
    }

    if (json.usage) {
      const input = json.usage.prompt_tokens ?? json.usage.input_tokens
      const output = json.usage.completion_tokens ?? json.usage.output_tokens
      if (typeof input === 'number') usage.inputTokens += input
      if (typeof output === 'number') usage.outputTokens += output
    }

    const message = json.choices?.[0]?.message
    const toolCalls = message?.tool_calls?.filter((call) => call.id && call.function?.name) ?? []
    if (toolCalls.length === 0) {
      const text = typeof message?.content === 'string' ? message.content : ''
      if (text) opts.onChunk(text)
      return { text, usage }
    }

    messages.push({
      role: 'assistant',
      content: typeof message?.content === 'string' ? message.content : null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id as string,
        type: 'function',
        function: {
          name: call.function?.name || '',
          arguments:
            typeof call.function?.arguments === 'string'
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments ?? {}),
        },
      })),
    })

    for (const call of toolCalls) {
      const name = call.function?.name
      const result = isTaskToolName(name)
        ? await runTaskTool(opts.supabase, opts.userId, name, parseToolArguments(call.function?.arguments))
        : { ok: false as const, error: 'Unknown task tool.' }
      messages.push({
        role: 'tool',
        tool_call_id: call.id as string,
        content: JSON.stringify(result),
      })
    }
  }

  const text = 'I could not finish that task request. Try a shorter instruction.'
  opts.onChunk(text)
  return { text, usage }
}

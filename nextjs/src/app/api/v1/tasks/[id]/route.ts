import { NextResponse, type NextRequest } from 'next/server'
import { completeTask, deleteTask, parseTaskId } from '@/lib/chat-task-tools'
import { createSSRClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireUser() {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { supabase, user }
}

function statusFor(result: { ok: boolean; error?: string }): number {
  if (result.ok) return 200
  if (result.error === 'Task not found.') return 404
  if (result.error?.includes('must be')) return 400
  return 500
}

/** POST /api/v1/tasks/[id] — { action: "complete" } marks the owned row done. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error
    const { id } = await context.params
    const taskId = parseTaskId(id)
    if (!taskId) {
      return NextResponse.json({ error: 'id must be a positive integer.' }, { status: 400 })
    }
    const body = (await request.json().catch(() => ({}))) as { action?: unknown }
    if (body.action !== 'complete') {
      return NextResponse.json({ error: 'action must be complete.' }, { status: 400 })
    }
    const result = await completeTask(auth.supabase, auth.user.id, { id: taskId })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: statusFor(result) })
    }
    return NextResponse.json({ task: result.task })
  } catch (err) {
    console.error('Task complete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/v1/tasks/[id] — delete one owned row. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error
    const { id } = await context.params
    const taskId = parseTaskId(id)
    if (!taskId) {
      return NextResponse.json({ error: 'id must be a positive integer.' }, { status: 400 })
    }
    const result = await deleteTask(auth.supabase, auth.user.id, { id: taskId })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: statusFor(result) })
    }
    return NextResponse.json({ deletedId: result.deletedId })
  } catch (err) {
    console.error('Task delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

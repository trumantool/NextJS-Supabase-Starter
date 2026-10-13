import { NextResponse, type NextRequest } from 'next/server'
import { listTasks, createTask } from '@/lib/chat-task-tools'
import { createSSRClient } from '@/lib/supabase/server'

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
  if (result.error?.includes('required') || result.error?.includes('must be')) return 400
  return 500
}

/** GET /api/v1/tasks — the signed-in owner's todo_list rows. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error
    const doneParam = request.nextUrl.searchParams.get('done')
    const args: Record<string, unknown> = {}
    if (doneParam === 'true') args.done = true
    if (doneParam === 'false') args.done = false
    const result = await listTasks(auth.supabase, auth.user.id, args)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: statusFor(result) })
    }
    return NextResponse.json({ tasks: result.tasks || [] })
  } catch (err) {
    console.error('Tasks GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/v1/tasks — create one owned to-do. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser()
    if ('error' in auth) return auth.error
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const result = await createTask(auth.supabase, auth.user.id, body)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: statusFor(result) })
    }
    return NextResponse.json({ task: result.task }, { status: 201 })
  } catch (err) {
    console.error('Tasks POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

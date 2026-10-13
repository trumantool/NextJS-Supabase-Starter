import { NextResponse, type NextRequest } from 'next/server'
import { parseTaskToolRequest, runTaskTool } from '@/lib/chat-task-tools'
import { createSSRClient } from '@/lib/supabase/server'

/**
 * POST /api/mcp/tasks
 * MCP-style tool call for list, create, complete, and delete on todo_list.
 * Uses the signed-in user. Does not use the service role.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = parseTaskToolRequest(body)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const result = await runTaskTool(supabase, user.id, parsed.name, parsed.arguments)
    const status = result.ok ? 200 : result.error === 'Task not found.' ? 404 : result.error.includes('must be') || result.error.includes('required') ? 400 : 500
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ tool: parsed.name, result })
  } catch (err) {
    console.error('MCP tasks error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { httpStatusForPostError } from '@/lib/posts'
import { deletePost, getMyPost, updatePost, type PostInput } from '@/lib/posts-store'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const post = await getMyPost(id)
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load post'
    console.error('Post GET error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as PostInput
    const post = await updatePost(id, body)
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update post'
    console.error('Post PUT error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    await deletePost(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete post'
    console.error('Post DELETE error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { createPost, listMyPosts, type PostInput } from '@/lib/posts-store'

function statusForError(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message === 'Post not found' || message === 'Parent post was not found') return 404
  if (
    message.includes('must') ||
    message.includes('too long') ||
    message.startsWith('Title') ||
    message.startsWith('Slug') ||
    message.startsWith('Status') ||
    message.startsWith('Type') ||
    message.startsWith('Body') ||
    message.startsWith('Sort') ||
    message.startsWith('A post')
  ) {
    return 400
  }
  return 500
}

export async function GET() {
  try {
    const posts = await listMyPosts()
    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list posts'
    console.error('Posts GET error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostInput
    const post = await createPost(body)
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create post'
    console.error('Posts POST error:', err)
    return NextResponse.json({ error: message }, { status: statusForError(message) })
  }
}

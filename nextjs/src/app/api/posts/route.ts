import { NextResponse, type NextRequest } from 'next/server'
import { ensureAuthorProfile, syncPostTerms } from '@/lib/blog-taxonomy'
import { httpStatusForPostError, requirePostWebsite } from '@/lib/posts'
import { createPost, listMyPosts, type PostInput } from '@/lib/posts-store'

export async function GET() {
  try {
    const posts = await listMyPosts()
    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list posts'
    console.error('Posts GET error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostInput
    const post = await createPost(body)
    const website = requirePostWebsite(process.env.POSTS_WEBSITE)
    if (body.categories !== undefined || body.tags !== undefined) {
      await syncPostTerms(post.id, website, body.categories, body.tags)
    }
    if (post.status === 'published' && post.author_id) {
      await ensureAuthorProfile(post.author_id, website)
    }
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create post'
    console.error('Posts POST error:', err)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

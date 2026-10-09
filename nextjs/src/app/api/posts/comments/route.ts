import { NextResponse, type NextRequest } from 'next/server'
import { httpStatusForPostError, normalizeCommentBody } from '@/lib/posts'
import { getPublishedPostBySlug } from '@/lib/posts-store'
import { createSSRClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const slug = typeof payload?.slug === 'string' ? payload.slug : ''
    const body = normalizeCommentBody(payload?.body)
    const post = await getPublishedPostBySlug(slug)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const { error } = await supabase.from('blog_comments').insert({
      post_id: post.id,
      user_id: user.id,
      body,
      status: 'pending',
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ status: 'pending' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save comment'
    console.error('Blog comment POST error:', message)
    return NextResponse.json({ error: message }, { status: httpStatusForPostError(message) })
  }
}

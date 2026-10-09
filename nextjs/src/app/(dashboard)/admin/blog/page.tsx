import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { deleteBlogPost, setBlogCommentStatus, unpublishBlogPost } from '@/app/(dashboard)/admin/blog/actions'
import { requirePostWebsite } from '@/lib/posts'
import { createSSRClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Blog moderation',
  description: 'Unpublish posts and review comments.',
}

export default async function AdminBlogPage() {
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    redirect('/dashboard')
  }

  const website = requirePostWebsite(process.env.POSTS_WEBSITE)
  const supabase = await createSSRClient()
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, slug, status, published_at, updated_at')
    .eq('website', website)
    .eq('type', 'blog')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)

  const postRows = posts ?? []
  const postIds = postRows.map((post) => post.id)
  const titles = new Map(postRows.map((post) => [post.id, post.title]))
  let comments: Array<{ id: string; post_id: string; body: string; status: string; created_at: string }> = []
  if (postIds.length > 0) {
    const { data, error: commentError } = await supabase
      .from('blog_comments')
      .select('id, post_id, body, status, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: false })
    if (commentError) throw new Error(commentError.message)
    comments = data ?? []
  }

  const { data: subscribers, error: subscriberError } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, status, created_at')
    .eq('website', website)
    .order('created_at', { ascending: false })
  if (subscriberError) throw new Error(subscriberError.message)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="mt-2 text-muted-foreground">Posts and comments for this site.</p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
          {postRows.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No blog posts yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 rounded-lg bg-white ring-1 ring-gray-200">
              {postRows.map((post) => (
                <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{post.title}</p>
                    <p className="text-sm text-gray-600">
                      {post.status}
                      {post.published_at ? ` · ${post.published_at.slice(0, 16).replace('T', ' ')}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/posts/${post.slug}`} className="text-sm text-gray-600 hover:underline">
                      View
                    </Link>
                    {post.status === 'published' ? (
                      <form action={unpublishBlogPost}>
                        <input type="hidden" name="id" value={post.id} />
                        <button type="submit" className="text-sm text-gray-900 hover:underline">
                          Unpublish
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteBlogPost}>
                      <input type="hidden" name="id" value={post.id} />
                      <button type="submit" className="text-sm text-red-700 hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
          {comments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No comments yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-white px-4 py-3 ring-1 ring-gray-200">
                  <p className="text-sm text-gray-500">
                    {titles.get(comment.post_id) ?? 'Post'} · {comment.status}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-gray-900">{comment.body}</p>
                  <div className="mt-3 flex gap-2">
                    <form action={setBlogCommentStatus}>
                      <input type="hidden" name="id" value={comment.id} />
                      <input type="hidden" name="status" value="visible" />
                      <button type="submit" className="text-sm text-gray-900 hover:underline">
                        Visible
                      </button>
                    </form>
                    <form action={setBlogCommentStatus}>
                      <input type="hidden" name="id" value={comment.id} />
                      <input type="hidden" name="status" value="hidden" />
                      <button type="submit" className="text-sm text-gray-900 hover:underline">
                        Hidden
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Newsletter</h2>
          {(subscribers ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No addresses yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 rounded-lg bg-white ring-1 ring-gray-200">
              {(subscribers ?? []).map((subscriber) => (
                <li key={subscriber.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-900">{subscriber.email}</span>
                  <span className="text-gray-500">{subscriber.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

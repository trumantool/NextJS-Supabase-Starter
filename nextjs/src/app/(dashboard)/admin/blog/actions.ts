'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { blogSlugsToRefresh, requirePostWebsite } from '@/lib/posts'
import { createSSRClient } from '@/lib/supabase/server'

async function requireAdmin() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/dashboard')
  }
}

function refreshBlog(slugs: string[]) {
  revalidatePath('/admin/blog')
  if (slugs.length === 0) return
  revalidatePath('/posts')
  revalidatePath('/posts/rss.xml')
  revalidatePath('/sitemap.xml')
  for (const slug of slugs) revalidatePath(`/posts/${slug}`)
}

export async function unpublishBlogPost(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const website = requirePostWebsite(process.env.POSTS_WEBSITE)
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, slug, status, published_at')
    .eq('id', id)
    .eq('website', website)
    .eq('type', 'blog')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Post not found')

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('website', website)
    .eq('type', 'blog')
  if (updateError) throw new Error(updateError.message)

  refreshBlog(
    blogSlugsToRefresh(data, {
      status: 'draft',
      published_at: data.published_at,
      slug: data.slug,
    })
  )
}

export async function deleteBlogPost(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const website = requirePostWebsite(process.env.POSTS_WEBSITE)
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, slug, status, published_at')
    .eq('id', id)
    .eq('website', website)
    .eq('type', 'blog')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Post not found')

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('website', website)
    .eq('type', 'blog')
  if (deleteError) throw new Error(deleteError.message)

  refreshBlog(blogSlugsToRefresh(data, null))
}

export async function setBlogCommentStatus(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (status !== 'visible' && status !== 'hidden') {
    throw new Error('Status must be visible or hidden')
  }
  const website = requirePostWebsite(process.env.POSTS_WEBSITE)
  const supabase = await createSSRClient()
  const { data: comment, error } = await supabase
    .from('blog_comments')
    .select('id, post_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!comment) throw new Error('Comment not found')

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, slug')
    .eq('id', comment.post_id)
    .eq('website', website)
    .eq('type', 'blog')
    .maybeSingle()
  if (postError) throw new Error(postError.message)
  if (!post) throw new Error('Comment not found')

  const { error: updateError } = await supabase.from('blog_comments').update({ status }).eq('id', id)
  if (updateError) throw new Error(updateError.message)

  revalidatePath('/admin/blog')
  revalidatePath(`/posts/${post.slug}`)
}

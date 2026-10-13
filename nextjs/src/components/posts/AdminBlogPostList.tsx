'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteBlogPost, unpublishBlogPost } from '@/app/(dashboard)/admin/blog/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { excerpt } from '@/lib/blog-roll'

export type AdminBlogPost = {
  id: string
  title: string
  slug: string
  status: string
  published_at: string | null
  summary: string | null
  body: string | null
  cover_image_url: string | null
}

export function AdminBlogPostList({ posts }: { posts: AdminBlogPost[] }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function confirmDelete(post: AdminBlogPost) {
    setPendingId(post.id)
    setError('')
    const result = await deleteBlogPost(post.id)
    setPendingId(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  if (posts.length === 0) {
    return <p className="mt-3 text-sm text-gray-600">No blog posts yet.</p>
  }

  return (
    <div className="mt-3">
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-gray-200 rounded-lg bg-white ring-1 ring-gray-200">
        {posts.map((post) => {
          const preview = excerpt(post.summary || post.body, 140)
          return (
            <li key={post.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
              {post.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-24 shrink-0 rounded bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{post.title}</p>
                <p className="text-sm text-gray-600">
                  {post.status}
                  {post.published_at ? ` · ${post.published_at.slice(0, 16).replace('T', ' ')}` : ''}
                </p>
                {preview ? <p className="mt-1 text-sm text-gray-600">{preview}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/posts/${post.slug}`} className="text-sm text-gray-600 hover:underline">
                  View
                </Link>
                <Link href={`/my-posts/${post.id}?from=admin`} className="text-sm text-gray-900 hover:underline">
                  Edit
                </Link>
                {post.status === 'published' ? (
                  <form action={unpublishBlogPost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button type="submit" className="text-sm text-gray-900 hover:underline">
                      Unpublish
                    </button>
                  </form>
                ) : null}
                <AlertDialog>
                  <AlertDialogTrigger className="text-sm text-red-700 hover:underline">
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{post.title}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This hides the post from the public blog and from My Posts. It does not remove the row.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={pendingId === post.id}
                        onClick={(event) => {
                          event.preventDefault()
                          void confirmDelete(post)
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

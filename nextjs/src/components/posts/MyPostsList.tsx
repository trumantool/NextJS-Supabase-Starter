'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type PostListItem = {
  id: string
  title: string
  slug: string
  summary: string | null
  status: string
}

export function MyPostsList() {
  const [posts, setPosts] = useState<PostListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/posts')
        const data = (await res.json()) as { posts?: PostListItem[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load posts')
        if (!cancelled) setPosts(data.posts ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load posts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Drafts stay private. Published posts are public.</p>
        </div>
        <Button asChild>
          <Link href="/my-posts/new">New post</Link>
        </Button>
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading posts…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && posts.length === 0 ? (
        <p className="text-sm text-gray-600">No posts yet.</p>
      ) : null}
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="rounded-md border bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/my-posts/${post.id}`} className="font-medium text-primary-700">
                  {post.title}
                </Link>
                <p className="mt-1 text-sm text-gray-500">
                  {post.status} · /posts/{post.slug}
                </p>
                {post.summary ? <p className="mt-2 text-sm text-gray-700">{post.summary}</p> : null}
              </div>
              {post.status === 'published' ? (
                <Link href={`/posts/${post.slug}`} className="text-sm text-gray-600 hover:underline">
                  View
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

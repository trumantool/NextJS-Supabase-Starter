'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Post } from '@/lib/types'

type EditorProps = { mode: 'new' | 'edit'; postId?: string }

export function PostEditor({ mode, postId }: EditorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('post')
  const [parentId, setParentId] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [videoUrl, setVideoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (mode !== 'edit' || !postId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/posts/${postId}`)
        const data = (await res.json()) as { post?: Post; error?: string }
        if (!res.ok || !data.post) throw new Error(data.error || 'Failed to load post')
        if (cancelled) return
        const post = data.post
        setTitle(post.title)
        setSlug(post.slug)
        setSummary(post.summary ?? '')
        setBody(post.body)
        setType(post.type)
        setParentId(post.parent_id ?? '')
        setStatus(post.status === 'published' ? 'published' : 'draft')
        setVideoUrl(post.video_url ?? '')
        setCoverImageUrl(post.cover_image_url ?? '')
        setSortOrder(String(post.sort_order))
        setOrigin(post.origin ?? '')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode, postId])

  function payload() {
    return {
      title,
      slug,
      summary,
      body,
      type,
      parent_id: parentId,
      status,
      video_url: videoUrl,
      cover_image_url: coverImageUrl,
      sort_order: Number(sortOrder),
      origin,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(mode === 'edit' ? `/api/posts/${postId}` : '/api/posts', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const data = (await res.json()) as { post?: Post; error?: string }
      if (!res.ok || !data.post) throw new Error(data.error || 'Failed to save post')
      router.push('/my-posts')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!postId) return
    if (!window.confirm('Delete this post?')) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to delete post')
      router.push('/my-posts')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {mode === 'edit' ? 'Edit post' : 'New post'}
        </h1>
        <Link href="/my-posts" className="text-sm text-gray-600 hover:underline">
          Back to posts
        </Link>
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading post…</p> : null}
      {!loading ? (
        <form onSubmit={handleSave} className="space-y-4 max-w-3xl">
          <div>
            <label htmlFor="post-title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-slug" className="block text-sm font-medium text-gray-700">
                Slug
              </label>
              <Input
                id="post-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Generated from the title if empty"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="post-type" className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <Input id="post-type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label htmlFor="post-summary" className="block text-sm font-medium text-gray-700">
              Summary
            </label>
            <Textarea id="post-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div>
            <label htmlFor="post-body" className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <Textarea id="post-body" value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="mt-1 font-mono" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="post-status"
                value={status}
                onChange={(e) => setStatus(e.target.value === 'published' ? 'published' : 'draft')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </div>
            <div>
              <label htmlFor="post-sort" className="block text-sm font-medium text-gray-700">
                Sort order
              </label>
              <Input
                id="post-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                inputMode="numeric"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label htmlFor="post-parent" className="block text-sm font-medium text-gray-700">
              Parent post id
            </label>
            <Input
              id="post-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-cover" className="block text-sm font-medium text-gray-700">
                Cover image URL
              </label>
              <Input id="post-cover" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label htmlFor="post-video" className="block text-sm font-medium text-gray-700">
                Video URL
              </label>
              <Input id="post-video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label htmlFor="post-origin" className="block text-sm font-medium text-gray-700">
              Origin
            </label>
            <Input id="post-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="mt-1" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {mode === 'edit' ? (
              <Button type="button" variant="outline" disabled={saving} onClick={handleDelete}>
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  )
}

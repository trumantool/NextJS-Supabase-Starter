'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateHTML, generateJSON } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { DocumentEditor } from '@/app/(dashboard)/documents/components/DocumentEditor'
import { AiPanel } from '@/app/(dashboard)/documents/components/AiPanel'
import type { TipTapDoc } from '@/app/(dashboard)/documents/lib/types'
import { docFromBody, isTipTapDoc } from '@/lib/blog-doc'
import { blogExtensions } from '@/lib/blog/youtube-extension'
import { youtubeVideoId } from '@/lib/blog/youtube'
import type { Post } from '@/lib/types'

const BLOG_PRESETS = ['Draft an introduction', 'Shorten this', 'Add a heading']

type EditorProps = { mode: 'new' | 'edit'; postId?: string; backHref: string }

type LoadedPost = Post & {
  seo_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function PostEditor({ mode, postId, backHref }: EditorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [summary, setSummary] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [ogImageUrl, setOgImageUrl] = useState('')
  const [doc, setDoc] = useState<TipTapDoc>(() => docFromBody(''))
  const [view, setView] = useState<'visual' | 'html'>('visual')
  const [html, setHtml] = useState('')
  const [youtubeDraft, setYoutubeDraft] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [videoUrl, setVideoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [categories, setCategories] = useState('')
  const [tags, setTags] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')

  useEffect(() => {
    if (mode !== 'edit' || !postId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/posts/${postId}`)
        const data = (await res.json()) as {
          post?: LoadedPost
          categories?: string[]
          tags?: string[]
          error?: string
        }
        if (!res.ok || !data.post) throw new Error(data.error || 'Failed to load post')
        if (cancelled) return
        const post = data.post
        setTitle(post.title)
        setSlug(post.slug)
        setSummary(post.summary ?? '')
        setSeoTitle(post.seo_title ?? '')
        setMetaDescription(post.meta_description ?? '')
        setOgImageUrl(post.og_image_url ?? '')
        setDoc(isTipTapDoc(post.body_doc) ? post.body_doc : docFromBody(post.body))
        setStatus(post.status === 'published' ? 'published' : 'draft')
        setVideoUrl(post.video_url ?? '')
        setCoverImageUrl(post.cover_image_url ?? '')
        setSortOrder(String(post.sort_order ?? 0))
        setCategories((data.categories ?? []).join(', '))
        setTags((data.tags ?? []).join(', '))
        setScheduleAt(toLocalInput(post.published_at))
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

  function documentForSave(): TipTapDoc {
    if (view !== 'html') return doc
    const next = generateJSON(html, blogExtensions)
    if (!isTipTapDoc(next)) throw new Error('HTML could not be read as a document')
    return next
  }

  function payload(action: 'draft' | 'publish' | 'schedule' | 'unpublish') {
    let nextStatus: 'draft' | 'published' = 'draft'
    let published_at: string | undefined
    if (action === 'publish') {
      nextStatus = 'published'
      published_at = new Date().toISOString()
    } else if (action === 'schedule') {
      nextStatus = 'published'
      const when = new Date(scheduleAt)
      if (!scheduleAt || Number.isNaN(when.getTime())) {
        throw new Error('Choose a time to schedule')
      }
      published_at = when.toISOString()
    }
    return {
      title,
      slug,
      summary,
      seo_title: seoTitle,
      meta_description: metaDescription,
      og_image_url: ogImageUrl,
      body_doc: documentForSave(),
      type: 'blog',
      status: nextStatus,
      published_at,
      video_url: videoUrl,
      cover_image_url: coverImageUrl,
      sort_order: Number(sortOrder),
      categories,
      tags,
    }
  }

  async function handleSave(action: 'draft' | 'publish' | 'schedule' | 'unpublish') {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(mode === 'edit' ? `/api/posts/${postId}` : '/api/posts', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(action)),
      })
      const data = (await res.json()) as { post?: Post; error?: string }
      if (!res.ok || !data.post) throw new Error(data.error || 'Failed to save post')
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  function showHtml() {
    try {
      setHtml(generateHTML(doc, blogExtensions))
      setView('html')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not show HTML')
    }
  }

  function showVisual() {
    try {
      const next = generateJSON(html, blogExtensions)
      if (!isTipTapDoc(next)) throw new Error('HTML could not be read as a document')
      setDoc(next)
      setView('visual')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HTML could not be read as a document')
    }
  }

  function insertYoutube() {
    const id = youtubeVideoId(youtubeDraft)
    if (!id) {
      setError('Enter a YouTube link')
      return
    }
    setDoc((prev) => ({
      type: 'doc',
      content: [...prev.content, { type: 'youtube', attrs: { videoId: id } }],
    }))
    setYoutubeDraft('')
    setError('')
  }

  function applyAi(text: string) {
    const lines = text.split('\n').filter((line) => line.trim())
    const content = lines.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }))
    setDoc((prev) => ({ type: 'doc', content: [...prev.content, ...content] }))
  }

  function requestImageUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/webp,image/gif'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        const form = new FormData()
        form.set('file', file)
        void fetch('/api/posts/media', { method: 'POST', body: form })
          .then(async (res) => {
            const data = (await res.json()) as { url?: string; error?: string }
            if (!res.ok || !data.url) {
              setError(data.error || 'Failed to upload image')
              resolve(null)
              return
            }
            resolve(data.url)
          })
          .catch(() => resolve(null))
      }
      input.click()
    })
  }

  async function uploadCover(file: File) {
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/posts/media', { method: 'POST', body: form })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to upload image')
      setCoverImageUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!postId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to delete post')
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
      setSaving(false)
    }
  }

  const deleteLabel = title.trim() || 'this post'

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {mode === 'edit' ? 'Edit post' : 'New post'}
        </h1>
        <Link href={backHref} className="text-sm text-gray-600 hover:underline">
          Back
        </Link>
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading post…</p> : null}
      {!loading ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave('draft')
          }}
          className="max-w-3xl min-w-0 space-y-4"
        >
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
          </div>
          <div>
            <label htmlFor="post-summary" className="block text-sm font-medium text-gray-700">
              Summary
            </label>
            <Textarea id="post-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-seo-title" className="block text-sm font-medium text-gray-700">
                SEO title
              </label>
              <Input
                id="post-seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Uses the post title when empty"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="post-og-image" className="block text-sm font-medium text-gray-700">
                Social image URL
              </label>
              <Input
                id="post-og-image"
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="Uses the cover image when empty"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label htmlFor="post-meta" className="block text-sm font-medium text-gray-700">
              Meta description
            </label>
            <Textarea
              id="post-meta"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              rows={2}
              placeholder="Uses the summary when empty"
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-categories" className="block text-sm font-medium text-gray-700">
                Categories
              </label>
              <Input
                id="post-categories"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="Comma-separated"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="post-tags" className="block text-sm font-medium text-gray-700">
                Tags
              </label>
              <Input
                id="post-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={view === 'visual' ? 'default' : 'outline'} onClick={showVisual}>
              Visual
            </Button>
            <Button type="button" variant={view === 'html' ? 'default' : 'outline'} onClick={showHtml}>
              HTML
            </Button>
          </div>
          {view === 'visual' ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                value={youtubeDraft}
                onChange={(e) => setYoutubeDraft(e.target.value)}
                placeholder="YouTube link"
                aria-label="YouTube link"
                className="min-w-0"
              />
              <Button type="button" variant="outline" onClick={insertYoutube}>
                Insert video
              </Button>
            </div>
          ) : null}
          {view === 'visual' ? (
            <div className="h-[640px] max-w-full min-w-0 overflow-hidden rounded-md border bg-white">
              <div className="flex h-full min-w-0">
                <div className="min-w-0 flex-1">
                  <DocumentEditor
                    initialDoc={doc}
                    extensions={blogExtensions}
                    onDocChange={setDoc}
                    onOpenAi={() => setAiOpen(true)}
                    onRequestImageUrl={requestImageUrl}
                  />
                </div>
                <AiPanel
                  open={aiOpen}
                  onClose={() => setAiOpen(false)}
                  doc={doc}
                  onApply={applyAi}
                  presets={BLOG_PRESETS}
                  purpose="blog"
                />
              </div>
            </div>
          ) : (
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              aria-label="HTML"
              rows={24}
              className="max-w-full min-h-[640px] min-w-0 font-mono text-sm"
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <p className="mt-1 text-sm text-gray-600">{status === 'published' ? 'published' : 'draft'}</p>
            </div>
            <div>
              <label htmlFor="post-schedule" className="block text-sm font-medium text-gray-700">
                Schedule
              </label>
              <Input
                id="post-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-1"
              />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="post-cover" className="block text-sm font-medium text-gray-700">
                Cover image URL
              </label>
              <Input id="post-cover" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="mt-1" />
              <input
                id="post-cover-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="mt-2 block max-w-full text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadCover(file)
                }}
              />
            </div>
            <div>
              <label htmlFor="post-video" className="block text-sm font-medium text-gray-700">
                Video URL
              </label>
              <Input id="post-video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="mt-1" />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave('publish')}>
              Publish now
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave('schedule')}>
              Schedule
            </Button>
            {status === 'published' ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave('unpublish')}>
                Unpublish
              </Button>
            ) : null}
            {mode === 'edit' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={saving}>
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{deleteLabel}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This hides the post from the public blog and from My Posts. It does not remove the row.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={saving}
                      onClick={(event) => {
                        event.preventDefault()
                        void handleDelete()
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  )
}

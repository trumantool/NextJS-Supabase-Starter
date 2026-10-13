'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
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
import { imagesMissingAlt, removedTagWarning, sanitizeEditorHtml } from '@/lib/blog/html-sanitize'
import { blogExtensions } from '@/lib/blog/youtube-extension'
import { youtubeVideoId } from '@/lib/blog/youtube'
import type { Post } from '@/lib/types'

const BLOG_PRESETS = ['Draft an introduction', 'Shorten this', 'Add a heading']

type EditorProps = { mode: 'new' | 'edit'; postId?: string; backHref: string }
type EditorTab = 'visual' | 'html'

type LoadedPost = Post & {
  seo_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_alt?: string | null
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function docIsEmpty(doc: TipTapDoc, text: string): boolean {
  if (text.trim()) return false
  const json = JSON.stringify(doc)
  return !json.includes('"type":"image"') && !json.includes('"type":"youtube"')
}

export function PostEditor({ mode, postId, backHref }: EditorProps) {
  const router = useRouter()
  const editorRef = useRef<Editor | null>(null)
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
  const [tab, setTab] = useState<EditorTab>('visual')
  const [htmlDraft, setHtmlDraft] = useState('')
  const [htmlBaseline, setHtmlBaseline] = useState('')
  const [visualBaseline, setVisualBaseline] = useState(() => JSON.stringify(docFromBody('')))
  const [htmlWarning, setHtmlWarning] = useState<string | null>(null)
  const [pendingTab, setPendingTab] = useState<EditorTab | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [youtubeDraft, setYoutubeDraft] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [videoUrl, setVideoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [coverImageAlt, setCoverImageAlt] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [categories, setCategories] = useState('')
  const [tags, setTags] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [baselineVersion, setBaselineVersion] = useState(0)

  const liveSnapshot = JSON.stringify({
    title,
    slug,
    summary,
    seoTitle,
    metaDescription,
    ogImageUrl,
    coverImageUrl,
    coverImageAlt,
    videoUrl,
    categories,
    tags,
    scheduleAt,
    sortOrder,
    status,
    doc,
  })
  const liveSnapshotRef = useRef(liveSnapshot)
  liveSnapshotRef.current = liveSnapshot
  const docRef = useRef(doc)
  docRef.current = doc
  const savedFields = useRef(liveSnapshot)
  const allowLeave = useRef(false)
  const htmlDirty = tab === 'html' && htmlDraft !== htmlBaseline
  const dirty = baselineVersion > 0 && (liveSnapshot !== savedFields.current || htmlDirty)

  useEffect(() => {
    if (loading) return
    savedFields.current = liveSnapshotRef.current
    setVisualBaseline(JSON.stringify(docRef.current))
    setBaselineVersion((version) => version + 1)
  }, [loading])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

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
        setCoverImageAlt(post.cover_image_alt ?? '')
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

  function openHtml() {
    const html = editorRef.current?.getHTML() ?? ''
    setHtmlDraft(html)
    setHtmlBaseline(html)
    setVisualBaseline(JSON.stringify(doc))
    setHtmlWarning(null)
    setTab('html')
  }

  function flushHtml(): TipTapDoc | null {
    const editor = editorRef.current
    if (!editor) {
      setError('The editor is still loading.')
      return null
    }
    const sanitized = sanitizeEditorHtml(htmlDraft)
    editor.commands.setContent(sanitized, true)
    const nextDoc = editor.getJSON() as TipTapDoc
    if (htmlDraft.trim() && docIsEmpty(nextDoc, editor.getText())) {
      setError('The HTML did not produce a document.')
      return null
    }
    const nextHtml = editor.getHTML()
    setDoc(nextDoc)
    setVisualBaseline(JSON.stringify(nextDoc))
    setHtmlDraft(nextHtml)
    setHtmlBaseline(nextHtml)
    const dropped = removedTagWarning(sanitized, nextHtml)
    const alt = imagesMissingAlt(sanitized) ? 'An image is missing alt text.' : null
    setHtmlWarning([dropped, alt].filter(Boolean).join(' ') || null)
    setError('')
    return nextDoc
  }

  function requestTab(next: EditorTab) {
    if (next === tab) return
    if (next === 'html' && JSON.stringify(doc) !== visualBaseline) {
      setPendingTab('html')
      return
    }
    if (next === 'visual' && htmlDraft !== htmlBaseline) {
      setPendingTab('visual')
      return
    }
    if (next === 'html') openHtml()
    else setTab('visual')
  }

  function payload(action: 'draft' | 'publish' | 'schedule' | 'unpublish', bodyDoc: TipTapDoc) {
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
      cover_image_alt: coverImageAlt,
      body_doc: bodyDoc,
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
      let bodyDoc = doc
      if (tab === 'html') {
        const flushed = flushHtml()
        if (!flushed) {
          setSaving(false)
          return
        }
        bodyDoc = flushed
      }
      const res = await fetch(mode === 'edit' ? `/api/posts/${postId}` : '/api/posts', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(action, bodyDoc)),
      })
      const data = (await res.json()) as { post?: Post; error?: string }
      if (!res.ok || !data.post) throw new Error(data.error || 'Failed to save post')
      allowLeave.current = true
      savedFields.current = liveSnapshotRef.current
      router.push(backHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  function insertYoutube() {
    const id = youtubeVideoId(youtubeDraft)
    if (!id) {
      setError('Enter a YouTube link')
      return
    }
    const editor = editorRef.current
    if (editor) {
      editor.commands.insertContent({ type: 'youtube', attrs: { videoId: id } })
    } else {
      setDoc((prev) => ({
        type: 'doc',
        content: [...prev.content, { type: 'youtube', attrs: { videoId: id } }],
      }))
    }
    setYoutubeDraft('')
    setError('')
  }

  function applyAi(text: string) {
    const lines = text.split('\n').filter((line) => line.trim())
    const content = lines.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }))
    const editor = editorRef.current
    if (editor) {
      editor.commands.insertContent(content)
      return
    }
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

  async function uploadImage(file: File, assign: (url: string) => void) {
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/posts/media', { method: 'POST', body: form })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to upload image')
      assign(data.url)
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
      allowLeave.current = true
      savedFields.current = liveSnapshotRef.current
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
        {dirty ? (
          <button type="button" onClick={() => setLeaveOpen(true)} className="text-sm text-gray-600 hover:underline">
            Back
          </button>
        ) : (
          <Link href={backHref} className="text-sm text-gray-600 hover:underline">
            Back
          </Link>
        )}
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
            <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 min-w-0 max-w-full" />
          </div>
          <div>
            <label htmlFor="post-slug" className="block text-sm font-medium text-gray-700">
              Slug
            </label>
            <Input
              id="post-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Generated from the title if empty"
              className="mt-1 min-w-0 max-w-full"
            />
          </div>
          <div>
            <label htmlFor="post-summary" className="block text-sm font-medium text-gray-700">
              Summary
            </label>
            <Textarea id="post-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="mt-1 min-w-0 max-w-full" />
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="post-categories" className="block text-sm font-medium text-gray-700">
                Categories
              </label>
              <Input
                id="post-categories"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="Comma-separated"
                className="mt-1 min-w-0 max-w-full"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="post-tags" className="block text-sm font-medium text-gray-700">
                Tags
              </label>
              <Input
                id="post-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated"
                className="mt-1 min-w-0 max-w-full"
              />
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-gray-700">Cover image</p>
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt={coverImageAlt.trim() || title || 'Cover image'}
                className="h-40 w-full max-w-full rounded-md object-cover"
              />
            ) : null}
            <label htmlFor="post-cover" className="block text-sm font-medium text-gray-700">
              Cover image URL
            </label>
            <Input
              id="post-cover"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="mt-1 min-w-0 max-w-full"
            />
            <input
              id="post-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label="Upload cover image"
              className="mt-2 block min-w-0 max-w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadImage(file, setCoverImageUrl)
              }}
            />
            <label htmlFor="post-cover-alt" className="block text-sm font-medium text-gray-700">
              Cover image alt text
            </label>
            <Input
              id="post-cover-alt"
              value={coverImageAlt}
              onChange={(e) => setCoverImageAlt(e.target.value)}
              placeholder="Falls back to the title when empty"
              aria-label="Cover image alt text"
              className="mt-1 min-w-0 max-w-full"
            />
          </div>
          <fieldset className="min-w-0 max-w-full space-y-3 rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-700">SEO</legend>
            <div>
              <label htmlFor="post-seo-title" className="block text-sm font-medium text-gray-700">
                SEO title
              </label>
              <Input
                id="post-seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Falls back to the title"
                aria-label="SEO title"
                className="mt-1 min-w-0 max-w-full"
              />
            </div>
            <div>
              <label htmlFor="post-meta" className="block text-sm font-medium text-gray-700">
                Meta description
              </label>
              <Textarea
                id="post-meta"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                placeholder="Falls back to the summary"
                aria-label="Meta description"
                className="mt-1 min-w-0 max-w-full"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="post-og-image" className="block text-sm font-medium text-gray-700">
                Open Graph image
              </label>
              <Input
                id="post-og-image"
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="Falls back to the cover image"
                aria-label="Open Graph image"
                className="mt-1 min-w-0 max-w-full"
              />
              {ogImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ogImageUrl}
                  alt={coverImageAlt.trim() || title || 'Open Graph image'}
                  className="h-32 w-full max-w-full rounded-md object-cover"
                />
              ) : null}
              <input
                id="post-og-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Upload Open Graph image"
                className="block min-w-0 max-w-full text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadImage(file, setOgImageUrl)
                }}
              />
            </div>
          </fieldset>
          <div>
            <label htmlFor="post-video" className="block text-sm font-medium text-gray-700">
              Video URL
            </label>
            <Input id="post-video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="mt-1 min-w-0 max-w-full" />
          </div>
          <div role="tablist" aria-label="Editor" className="flex min-w-0 gap-2">
            <Button type="button" role="tab" aria-selected={tab === 'visual'} variant={tab === 'visual' ? 'default' : 'outline'} onClick={() => requestTab('visual')}>
              Visual
            </Button>
            <Button type="button" role="tab" aria-selected={tab === 'html'} variant={tab === 'html' ? 'default' : 'outline'} onClick={() => requestTab('html')}>
              HTML
            </Button>
          </div>
          {tab === 'html' ? (
            <div className="min-w-0 max-w-full space-y-2">
              <Textarea
                value={htmlDraft}
                onChange={(e) => setHtmlDraft(e.target.value)}
                spellCheck={false}
                aria-label="Post HTML"
                rows={16}
                className="max-w-full min-h-64 min-w-0 font-mono text-sm"
              />
              {htmlWarning ? <p className="text-sm text-amber-800">{htmlWarning}</p> : null}
            </div>
          ) : (
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
          )}
          <div className={tab === 'html' ? 'hidden' : 'h-[640px] max-w-full min-w-0 overflow-hidden rounded-md border bg-white'}>
            <div className="flex h-full min-w-0">
              <div className="min-w-0 flex-1">
                <DocumentEditor
                  initialDoc={doc}
                  extensions={blogExtensions}
                  onDocChange={setDoc}
                  onOpenAi={() => setAiOpen(true)}
                  onRequestImageUrl={requestImageUrl}
                  hidden={tab === 'html'}
                  editorRef={editorRef}
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
                className="mt-1 min-w-0 max-w-full"
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex min-w-0 max-w-full flex-wrap gap-3">
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
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={(event) => {
                        event.preventDefault()
                        void handleDelete()
                      }}
                    >
                      Delete
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </form>
      ) : null}
      <AlertDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved edits?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching tabs converts this tab and drops the other unsaved copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (pendingTab === 'html') {
                  openHtml()
                  setPendingTab(null)
                  return
                }
                const flushed = flushHtml()
                if (!flushed) return
                setTab('visual')
                setPendingTab(null)
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              {title.trim() || 'Untitled'} has unsaved edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                allowLeave.current = true
                savedFields.current = liveSnapshotRef.current
                router.push(backHref)
              }}
            >
              Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

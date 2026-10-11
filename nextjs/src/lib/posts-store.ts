import { revalidatePath } from 'next/cache'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import type { Database, Post } from '@/lib/types'
import {
  BLOG_TYPE,
  SLUG_TAKEN_MESSAGE,
  blogSlugsToRefresh,
  ilikeContainsPattern,
  isBlogType,
  isHttpUrl,
  isMissingBlogSchemaError,
  isMissingBodyDocError,
  isPostSlug,
  logBlogSchemaGap,
  publicPostWebsite,
  requirePostWebsite,
  resolvePublication,
  slugifyTitle,
  type PostWebsite,
} from '@/lib/posts'
import { docToMarkdown, isTipTapDoc } from '@/lib/blog-doc'

export type PostInput = {
  title?: unknown
  slug?: unknown
  summary?: unknown
  body?: unknown
  type?: unknown
  status?: unknown
  video_url?: unknown
  cover_image_url?: unknown
  sort_order?: unknown
  categories?: unknown
  tags?: unknown
  published_at?: unknown
  body_doc?: unknown
}

const LIST_COLUMNS =
  'id, website, type, parent_id, title, slug, summary, cover_image_url, sort_order, status, published_at, author_id, updated_at'

function requireWebsite(): PostWebsite {
  return requirePostWebsite(process.env.POSTS_WEBSITE)
}

function readPublicWebsite(): PostWebsite | null {
  return publicPostWebsite(process.env.POSTS_WEBSITE)
}

function rowsOrEmpty<T>(
  error: { code?: string; message: string } | null,
  data: T[] | null,
  label: string
): T[] {
  if (!error) return data ?? []
  if (isMissingBlogSchemaError(error)) {
    logBlogSchemaGap(label, error)
    return []
  }
  throw new Error(error.message)
}

function rowOrEmpty<T>(
  error: { code?: string; message: string } | null,
  data: T | null,
  label: string
): T | null {
  if (!error) return data
  if (isMissingBlogSchemaError(error)) {
    logBlogSchemaGap(label, error)
    return null
  }
  throw new Error(error.message)
}

async function requireUserId(): Promise<string> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be text`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) throw new Error(`${label} is too long`)
  return trimmed
}

function optionalUrl(value: unknown, label: string): string | null {
  const text = optionalText(value, 2000, label)
  if (!text) return null
  if (!isHttpUrl(text)) throw new Error(`${label} must be an http(s) URL`)
  return text
}

function throwPostWriteError(error: { message: string; code?: string }): never {
  if (error.code === '23505' && error.message.includes('posts_root_type_slug_key')) {
    console.error('posts slug conflict', { constraint: 'posts_root_type_slug_key' })
    throw new Error(SLUG_TAKEN_MESSAGE)
  }
  throw new Error(error.message)
}

async function assertRootBlogSlugAvailable(slug: string, ignoreId?: string): Promise<void> {
  const admin = await createServerAdminClient()
  const { data, error } = await admin
    .from('posts')
    .select('id')
    .eq('type', 'blog')
    .is('parent_id', null)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data && data.id !== ignoreId) {
    console.error('posts slug conflict', { constraint: 'posts_root_type_slug_key' })
    throw new Error(SLUG_TAKEN_MESSAGE)
  }
}

export type PostListItem = Pick<
  Post,
  | 'id'
  | 'website'
  | 'type'
  | 'parent_id'
  | 'title'
  | 'slug'
  | 'summary'
  | 'cover_image_url'
  | 'sort_order'
  | 'status'
  | 'published_at'
  | 'author_id'
  | 'updated_at'
>

export async function listMyPosts(): Promise<PostListItem[]> {
  await requireUserId()
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select(LIST_COLUMNS)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PostListItem[]
}

export const PUBLIC_COLUMNS =
  'id, website, type, title, slug, summary, body, cover_image_url, video_url, published_at, sort_order, author_id, updated_at'

export type PublishedPost = {
  id: string
  website: string
  type: string
  title: string
  slug: string
  summary: string | null
  body: string | null
  cover_image_url: string | null
  /** Absent until cover_image_alt exists. A missing column is stored as null. */
  cover_image_alt?: string | null
  video_url: string | null
  published_at: string | null
  sort_order: number | null
  author_id: string | null
  updated_at: string
}

type PostQueryError = { code?: string; message: string } | null

function attachCoverAlt(row: PublishedPost): PublishedPost {
  const alt = (row as PublishedPost & { cover_image_alt?: unknown }).cover_image_alt
  return { ...row, cover_image_alt: typeof alt === 'string' && alt.trim() ? alt : null }
}

/**
 * Try the cover alt column, then the stable public column list.
 * A shared database without cover_image_alt still returns the posts.
 */
async function selectWithCoverAlt(
  label: string,
  run: (columns: string) => Promise<{ data: PublishedPost[] | null; error: PostQueryError }>
): Promise<PublishedPost[]> {
  const wide = await run(`${PUBLIC_COLUMNS}, cover_image_alt`)
  if (!wide.error) return (wide.data ?? []).map(attachCoverAlt)
  if (!isMissingBlogSchemaError(wide.error)) return rowsOrEmpty(wide.error, wide.data, label)
  logBlogSchemaGap('posts.cover_image_alt', wide.error)
  const narrow = await run(PUBLIC_COLUMNS)
  return rowsOrEmpty(narrow.error, narrow.data, label).map((row) => ({ ...row, cover_image_alt: null }))
}

function liveNow(): string {
  return new Date().toISOString()
}

export async function listPublishedPosts(): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts', async (columns) => {
    const { data, error } = await supabase
      .from('posts')
      .select(columns as typeof PUBLIC_COLUMNS)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .eq('status', 'published')
      .lte('published_at', liveNow())
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function getPublishedPostBySlug(slug: string): Promise<PublishedPost | null> {
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const run = async (columns: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select(columns as typeof PUBLIC_COLUMNS)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .eq('status', 'published')
      .lte('published_at', liveNow())
      .eq('slug', slug)
      .maybeSingle()
    return { data: (data as PublishedPost | null) ?? null, error }
  }
  let result = await run(`${PUBLIC_COLUMNS}, cover_image_alt`)
  if (result.error && isMissingBlogSchemaError(result.error)) {
    logBlogSchemaGap('posts.cover_image_alt', result.error)
    result = await run(PUBLIC_COLUMNS)
  }
  const row = rowOrEmpty(result.error, result.data, 'published post')
  if (!row) return null
  return attachCoverAlt(row)
}

export async function listPublishedPostsByIds(ids: string[]): Promise<PublishedPost[]> {
  if (ids.length === 0) return []
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts by id', async (columns) => {
    const { data, error } = await supabase
      .from('posts')
      .select(columns as typeof PUBLIC_COLUMNS)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .eq('status', 'published')
      .lte('published_at', liveNow())
      .in('id', ids)
      .order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function listPublishedPostsForAuthor(authorId: string): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts by author', async (columns) => {
    const { data, error } = await supabase
      .from('posts')
      .select(columns as typeof PUBLIC_COLUMNS)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .eq('status', 'published')
      .eq('author_id', authorId)
      .lte('published_at', liveNow())
      .order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function searchPublishedPosts(query: string): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const pattern = ilikeContainsPattern(query.trim())
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const supabase = await createSSRClient()
  return selectWithCoverAlt('post search', async (columns) => {
    const { data, error } = await supabase
      .from('posts')
      .select(columns as typeof PUBLIC_COLUMNS)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .eq('status', 'published')
      .lte('published_at', liveNow())
      .or(`title.ilike.${quoted},summary.ilike.${quoted}`)
      .order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function getMyPost(id: string): Promise<Post> {
  const website = requireWebsite()
  await requireUserId()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('website', website)
    .eq('type', BLOG_TYPE)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Post not found')
  return data as Post
}

export async function createPost(input: PostInput): Promise<Post> {
  const website = requireWebsite()
  const userId = await requireUserId()
  const fields = await normalizePost(input, website)
  const supabase = await createSSRClient()
  let result = await supabase
    .from('posts')
    .insert({ ...fields, author_id: userId, website })
    .select('*')
    .single()
  if (result.error && isMissingBodyDocError(result.error)) {
    logBlogSchemaGap('posts.body_doc', result.error)
    result = await supabase
      .from('posts')
      .insert({ ...omitBodyDoc(fields), author_id: userId, website })
      .select('*')
      .single()
  }
  if (result.error) throwPostWriteError(result.error)
  const saved = result.data as Post
  refreshPublicBlog(blogSlugsToRefresh(null, saved))
  return saved
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const website = requireWebsite()
  const userId = await requireUserId()
  const existing = await getMyPost(id)
  if (existing.author_id !== userId || existing.website !== website) throw new Error('Post not found')
  const fields = await normalizePost(input, website, existing)
  const supabase = await createSSRClient()
  const runUpdate = (values: PostUpdate) =>
    supabase
      .from('posts')
      .update({ ...values, website })
      .eq('id', id)
      .eq('author_id', userId)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
      .select('*')
      .single()
  let result = await runUpdate(fields)
  if (result.error && isMissingBodyDocError(result.error)) {
    logBlogSchemaGap('posts.body_doc', result.error)
    result = await runUpdate(omitBodyDoc(fields))
  }
  if (result.error) throwPostWriteError(result.error)
  const saved = result.data as Post
  const revision = {
    post_id: saved.id,
    editor_id: userId,
    title: saved.title,
    slug: saved.slug,
    summary: saved.summary,
    body: saved.body,
    ...(saved.body_doc === undefined ? {} : { body_doc: saved.body_doc }),
  }
  const { error: revisionError } = await supabase.from('blog_revisions').insert(revision)
  if (revisionError) {
    if (isMissingBlogSchemaError(revisionError) || isMissingBodyDocError(revisionError)) {
      logBlogSchemaGap('blog_revisions', revisionError)
    } else {
      throw new Error(revisionError.message)
    }
  }
  refreshPublicBlog(
    blogSlugsToRefresh(
      { status: existing.status, published_at: existing.published_at, slug: existing.slug },
      saved
    )
  )
  return saved
}

export async function deletePost(id: string): Promise<void> {
  const website = requireWebsite()
  const userId = await requireUserId()
  const existing = await getMyPost(id)
  const supabase = await createSSRClient()
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', userId)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
  if (error) throw new Error(error.message)
  refreshPublicBlog(
    blogSlugsToRefresh(
      { status: existing.status, published_at: existing.published_at, slug: existing.slug },
      null
    )
  )
}

type PostUpdate = Database['public']['Tables']['posts']['Update']

function omitBodyDoc<T extends { body_doc?: unknown }>(fields: T): Omit<T, 'body_doc'> {
  const copy = { ...fields }
  delete copy.body_doc
  return copy
}

function refreshPublicBlog(slugs: string[]) {
  if (slugs.length === 0) return
  revalidatePath('/posts')
  revalidatePath('/posts/rss.xml')
  revalidatePath('/sitemap.xml')
  for (const slug of slugs) revalidatePath(`/posts/${slug}`)
}

async function normalizePost(input: PostInput, _website: PostWebsite, existing?: Post) {
  const title = typeof input.title === 'string' ? input.title.trim() : existing?.title ?? ''
  if (!title || title.length > 200) throw new Error('Title must be 1–200 characters')

  const requestedSlug =
    typeof input.slug === 'string' && input.slug.trim()
      ? input.slug.trim().toLowerCase()
      : existing?.slug ?? slugifyTitle(title)
  if (!isPostSlug(requestedSlug)) {
    throw new Error('Slug must be 2–80 lowercase letters, numbers, and hyphens')
  }
  await assertRootBlogSlugAvailable(requestedSlug, existing?.id)

  if (input.type != null && input.type !== '' && !isBlogType(String(input.type))) {
    throw new Error('Type must be blog')
  }
  if (existing && existing.type !== BLOG_TYPE) {
    throw new Error('Type must be blog')
  }

  const summary = optionalText(input.summary ?? existing?.summary ?? null, 500, 'Summary')
  let bodyText = ''
  if (input.body_doc !== undefined) {
    if (input.body_doc === null) {
      bodyText = typeof input.body === 'string' ? input.body : existing?.body ?? ''
    } else if (!isTipTapDoc(input.body_doc)) {
      throw new Error('Body must be a document')
    } else {
      bodyText = docToMarkdown(input.body_doc)
    }
  } else {
    const bodySource = input.body ?? existing?.body ?? ''
    if (bodySource != null && typeof bodySource !== 'string') throw new Error('Body must be text')
    bodyText = typeof bodySource === 'string' ? bodySource : ''
  }
  if (bodyText.length > 200000) throw new Error('Body is too long')
  const bodyDoc =
    input.body_doc === undefined
      ? existing?.body_doc ?? null
      : input.body_doc === null
        ? null
        : (input.body_doc as unknown as Post['body_doc'])

  const statusRaw = typeof input.status === 'string' ? input.status : existing?.status ?? 'draft'
  if (statusRaw !== 'draft' && statusRaw !== 'published') {
    throw new Error('Status must be draft or published')
  }

  const publication = resolvePublication({
    status: statusRaw,
    publishedAt: input.published_at,
    existingPublishedAt: existing?.published_at ?? null,
  })

  const sortSource = input.sort_order ?? existing?.sort_order ?? 0
  const sort_order = typeof sortSource === 'number' ? sortSource : Number(sortSource)
  if (!Number.isInteger(sort_order)) throw new Error('Sort order must be an integer')

  return {
    title,
    slug: requestedSlug,
    type: BLOG_TYPE,
    summary,
    body: bodyText,
    body_doc: bodyDoc,
    parent_id: null,
    status: publication.status,
    published_at: publication.published_at,
    video_url: optionalUrl(input.video_url ?? existing?.video_url ?? null, 'Video URL'),
    cover_image_url: optionalUrl(
      input.cover_image_url ?? existing?.cover_image_url ?? null,
      'Cover image URL'
    ),
    sort_order,
    origin: null,
  }
}

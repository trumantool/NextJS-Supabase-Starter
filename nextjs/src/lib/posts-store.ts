import { revalidatePath } from 'next/cache'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import type { Database, Json, Post } from '@/lib/types'
import {
  BLOG_TYPE,
  SLUG_TAKEN_MESSAGE,
  SOFT_DELETE_UNAVAILABLE,
  blogSlugsToRefresh,
  ilikeContainsPattern,
  isBlogType,
  isHttpUrl,
  isMissingBlogSchemaError,
  isMissingDeletedAtError,
  isPostSlug,
  logBlogSchemaGap,
  publicPostWebsite,
  requirePostWebsite,
  resolvePublication,
  slugifyTitle,
  type PostWebsite,
} from '@/lib/posts'
import { bodyDocIsSafe, docToMarkdown, isTipTapDoc } from '@/lib/blog-doc'

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
  seo_title?: unknown
  meta_description?: unknown
  og_image_url?: unknown
  cover_image_alt?: unknown
}

type PostWrite = Database['public']['Tables']['posts']['Update'] & {
  seo_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_alt?: string | null
  deleted_at?: string
}

type PostsInsert = Database['public']['Tables']['posts']['Insert']
type PostsUpdate = Database['public']['Tables']['posts']['Update']

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
  const load = (hideDeleted: boolean) =>
    notDeleted(
      supabase.from('posts').select(LIST_COLUMNS).eq('website', website).eq('type', BLOG_TYPE),
      hideDeleted
    ).order('updated_at', { ascending: false })
  let result = await load(true)
  if (result.error && isMissingDeletedAtError(result.error)) {
    logBlogSchemaGap('posts.deleted_at', result.error)
    result = await load(false)
  }
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as PostListItem[]
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
  /** Present when the shared table has the column and the select included it. */
  body_doc?: Json | null
  seo_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  video_url: string | null
  published_at: string | null
  sort_order: number | null
  author_id: string | null
  updated_at: string
}

type PostQueryError = { code?: string; message: string } | null

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function attachCoverAlt(row: PublishedPost): PublishedPost {
  const loose = row as PublishedPost & {
    cover_image_alt?: unknown
    seo_title?: unknown
    meta_description?: unknown
    og_image_url?: unknown
  }
  return {
    ...row,
    cover_image_alt: textOrNull(loose.cover_image_alt),
    seo_title: textOrNull(loose.seo_title),
    meta_description: textOrNull(loose.meta_description),
    og_image_url: textOrNull(loose.og_image_url),
  }
}

const PUBLISHED_COLUMN_SETS = [
  `${PUBLIC_COLUMNS}, body_doc, cover_image_alt, seo_title, meta_description, og_image_url`,
  `${PUBLIC_COLUMNS}, body_doc, cover_image_alt`,
  `${PUBLIC_COLUMNS}, cover_image_alt`,
  PUBLIC_COLUMNS,
]

/** Hide soft-deleted rows. Callers retry without this when the column is missing. */
function notDeleted<T>(query: T, hideDeleted: boolean): T {
  if (!hideDeleted) return query
  return (query as unknown as { is: (column: string, value: null) => T }).is('deleted_at', null)
}

async function readWithFallback<T>(
  label: string,
  run: (columns: string, hideDeleted: boolean) => Promise<{ data: T | null; error: PostQueryError }>
): Promise<{ data: T | null; error: PostQueryError }> {
  let hideDeleted = true
  let index = 0
  let last: { data: T | null; error: PostQueryError } = { data: null, error: null }
  while (index < PUBLISHED_COLUMN_SETS.length) {
    last = await run(PUBLISHED_COLUMN_SETS[index], hideDeleted)
    if (!last.error) return last
    if (hideDeleted && isMissingDeletedAtError(last.error)) {
      logBlogSchemaGap('posts.deleted_at', last.error)
      hideDeleted = false
      continue
    }
    if (!isMissingBlogSchemaError(last.error)) return last
    logBlogSchemaGap(label, last.error)
    index += 1
  }
  return last
}

/**
 * Try SEO and cover columns, then narrower lists.
 * A missing deleted_at filter is logged and the same columns are read again.
 */
async function selectWithCoverAlt(
  label: string,
  run: (columns: string, hideDeleted: boolean) => Promise<{ data: PublishedPost[] | null; error: PostQueryError }>
): Promise<PublishedPost[]> {
  const result = await readWithFallback(label, run)
  return rowsOrEmpty(result.error, result.data, label).map(attachCoverAlt)
}

function liveNow(): string {
  return new Date().toISOString()
}

export async function listPublishedPosts(): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts', async (columns, hideDeleted) => {
    const filtered = notDeleted(
      supabase
        .from('posts')
        .select(columns as typeof PUBLIC_COLUMNS)
        .eq('website', website)
        .eq('type', BLOG_TYPE)
        .eq('status', 'published')
        .lte('published_at', liveNow()),
      hideDeleted
    )
    const { data, error } = await filtered
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function getPublishedPostBySlug(slug: string): Promise<PublishedPost | null> {
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const result = await readWithFallback('published post', async (columns, hideDeleted) => {
    const filtered = notDeleted(
      supabase
        .from('posts')
        .select(columns as typeof PUBLIC_COLUMNS)
        .eq('website', website)
        .eq('type', BLOG_TYPE)
        .eq('status', 'published')
        .lte('published_at', liveNow())
        .eq('slug', slug),
      hideDeleted
    )
    const { data, error } = await filtered.maybeSingle()
    return { data: (data as PublishedPost | null) ?? null, error }
  })
  const row = rowOrEmpty(result.error, result.data, 'published post')
  if (!row) return null
  return attachCoverAlt(row)
}

export async function listPublishedPostsByIds(ids: string[]): Promise<PublishedPost[]> {
  if (ids.length === 0) return []
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts by id', async (columns, hideDeleted) => {
    const filtered = notDeleted(
      supabase
        .from('posts')
        .select(columns as typeof PUBLIC_COLUMNS)
        .eq('website', website)
        .eq('type', BLOG_TYPE)
        .eq('status', 'published')
        .lte('published_at', liveNow())
        .in('id', ids),
      hideDeleted
    )
    const { data, error } = await filtered.order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function listPublishedPostsForAuthor(authorId: string): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  return selectWithCoverAlt('published posts by author', async (columns, hideDeleted) => {
    const filtered = notDeleted(
      supabase
        .from('posts')
        .select(columns as typeof PUBLIC_COLUMNS)
        .eq('website', website)
        .eq('type', BLOG_TYPE)
        .eq('status', 'published')
        .eq('author_id', authorId)
        .lte('published_at', liveNow()),
      hideDeleted
    )
    const { data, error } = await filtered.order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function searchPublishedPosts(query: string): Promise<PublishedPost[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const pattern = ilikeContainsPattern(query.trim())
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const supabase = await createSSRClient()
  return selectWithCoverAlt('post search', async (columns, hideDeleted) => {
    const filtered = notDeleted(
      supabase
        .from('posts')
        .select(columns as typeof PUBLIC_COLUMNS)
        .eq('website', website)
        .eq('type', BLOG_TYPE)
        .eq('status', 'published')
        .lte('published_at', liveNow())
        .or(`title.ilike.${quoted},summary.ilike.${quoted}`),
      hideDeleted
    )
    const { data, error } = await filtered.order('published_at', { ascending: false })
    return { data: (data as PublishedPost[] | null) ?? null, error }
  })
}

export async function getMyPost(id: string): Promise<Post> {
  const website = requireWebsite()
  await requireUserId()
  const supabase = await createSSRClient()
  const load = (hideDeleted: boolean) =>
    notDeleted(
      supabase.from('posts').select('*').eq('website', website).eq('type', BLOG_TYPE).eq('id', id),
      hideDeleted
    ).maybeSingle()
  let result = await load(true)
  if (result.error && isMissingDeletedAtError(result.error)) {
    logBlogSchemaGap('posts.deleted_at', result.error)
    result = await load(false)
  }
  if (result.error) throw new Error(result.error.message)
  if (!result.data) throw new Error('Post not found')
  return result.data as Post
}

async function canEditPost(existing: Post, userId: string): Promise<boolean> {
  if (existing.author_id === userId) return true
  return isCurrentUserAdmin()
}

function dropMissingWriteColumn(fields: PostWrite, error: { code?: string; message?: string }): PostWrite | null {
  if (!isMissingBlogSchemaError(error)) return null
  const message = error.message ?? ''
  if (/body_doc/i.test(message) && 'body_doc' in fields) {
    const copy = { ...fields }
    delete copy.body_doc
    return copy
  }
  if (/seo_title|meta_description|og_image_url/i.test(message)) {
    const copy = { ...fields }
    delete copy.seo_title
    delete copy.meta_description
    delete copy.og_image_url
    return copy
  }
  if (/cover_image_alt/i.test(message) && 'cover_image_alt' in fields) {
    const copy = { ...fields }
    delete copy.cover_image_alt
    return copy
  }
  return null
}

async function insertPost(values: PostWrite) {
  const supabase = await createSSRClient()
  let current = values
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await supabase
      .from('posts')
      .insert({ ...current, website: current.website } as unknown as PostsInsert)
      .select('*')
      .single()
    if (!result.error) return result
    const next = dropMissingWriteColumn(current, result.error)
    if (!next) return result
    logBlogSchemaGap('posts optional column', result.error)
    current = next
  }
  return supabase
    .from('posts')
    .insert({ ...current, website: current.website } as unknown as PostsInsert)
    .select('*')
    .single()
}

export async function createPost(input: PostInput): Promise<Post> {
  const website = requireWebsite()
  const userId = await requireUserId()
  const fields = await normalizePost(input, website)
  const result = await insertPost({ ...fields, author_id: userId, website })
  if (result.error) throwPostWriteError(result.error)
  const saved = result.data as Post
  refreshPublicBlog(blogSlugsToRefresh(null, saved))
  return saved
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const website = requireWebsite()
  const userId = await requireUserId()
  const existing = await getMyPost(id)
  if (existing.website !== website || !(await canEditPost(existing, userId))) {
    throw new Error('Post not found')
  }
  const fields = await normalizePost(input, website, existing)
  const supabase = await createSSRClient()
  const admin = await isCurrentUserAdmin()
  const runUpdate = (values: PostWrite) => {
    let query = supabase
      .from('posts')
      .update({ ...values, website } as unknown as PostsUpdate)
      .eq('id', id)
      .eq('website', website)
      .eq('type', BLOG_TYPE)
    if (!admin) query = query.eq('author_id', userId)
    return query.select('*').single()
  }
  let current: PostWrite = fields
  let result = await runUpdate(current)
  for (let attempt = 0; attempt < 4 && result.error; attempt += 1) {
    const next = dropMissingWriteColumn(current, result.error)
    if (!next) break
    logBlogSchemaGap('posts optional column', result.error)
    current = next
    result = await runUpdate(current)
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
    if (isMissingBlogSchemaError(revisionError)) {
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
  if (existing.website !== website || !(await canEditPost(existing, userId))) {
    throw new Error('Post not found')
  }
  const supabase = await createSSRClient()
  const admin = await isCurrentUserAdmin()
  let query = supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() } as unknown as PostsUpdate)
    .eq('id', id)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
  if (!admin) query = query.eq('author_id', userId)
  const { error } = await query
  if (error && isMissingDeletedAtError(error)) {
    logBlogSchemaGap('posts.deleted_at', error)
    throw new Error(SOFT_DELETE_UNAVAILABLE)
  }
  if (error) throw new Error(error.message)
  refreshPublicBlog(
    blogSlugsToRefresh(
      { status: existing.status, published_at: existing.published_at, slug: existing.slug },
      null
    )
  )
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
  const prior = existing as (Post & {
    seo_title?: string | null
    meta_description?: string | null
    og_image_url?: string | null
    cover_image_alt?: string | null
  }) | undefined
  let bodyText = ''
  if (input.body_doc !== undefined) {
    if (input.body_doc === null) {
      bodyText = typeof input.body === 'string' ? input.body : existing?.body ?? ''
    } else if (!isTipTapDoc(input.body_doc)) {
      throw new Error('Body must be a document')
    } else if (!bodyDocIsSafe(input.body_doc.content)) {
      throw new Error('The document is not valid.')
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
    seo_title: optionalText(input.seo_title ?? prior?.seo_title ?? null, 200, 'SEO title'),
    meta_description: optionalText(
      input.meta_description ?? prior?.meta_description ?? null,
      300,
      'Meta description'
    ),
    og_image_url: optionalUrl(input.og_image_url ?? prior?.og_image_url ?? null, 'Social image URL'),
    cover_image_alt: optionalText(
      input.cover_image_alt ?? prior?.cover_image_alt ?? null,
      500,
      'Cover image alt text'
    ),
    sort_order,
    origin: null,
  }
}

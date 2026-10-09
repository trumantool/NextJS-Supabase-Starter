import { createSSRClient } from '@/lib/supabase/server'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import type { Post } from '@/lib/types'
import {
  BLOG_TYPE,
  SLUG_TAKEN_MESSAGE,
  isBlogType,
  isHttpUrl,
  isPostSlug,
  requirePostWebsite,
  slugifyTitle,
  type PostWebsite,
} from '@/lib/posts'

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
}

const LIST_COLUMNS =
  'id, website, type, parent_id, title, slug, summary, cover_image_url, sort_order, status, published_at, author_id, updated_at'

function currentWebsite(): PostWebsite {
  return requirePostWebsite(process.env.POSTS_WEBSITE)
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
  const website = currentWebsite()
  await requireUserId()
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

const PUBLIC_COLUMNS =
  'id, website, type, title, slug, summary, body, cover_image_url, video_url, published_at, sort_order'

export type PublishedPost = {
  id: string
  website: string
  type: string
  title: string
  slug: string
  summary: string | null
  body: string | null
  cover_image_url: string | null
  video_url: string | null
  published_at: string | null
  sort_order: number | null
}

export async function listPublishedPosts(): Promise<PublishedPost[]> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select(PUBLIC_COLUMNS)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PublishedPost[]
}

export async function getPublishedPostBySlug(slug: string): Promise<PublishedPost | null> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select(PUBLIC_COLUMNS)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PublishedPost | null) ?? null
}

export async function getMyPost(id: string): Promise<Post> {
  const website = currentWebsite()
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
  const website = currentWebsite()
  const userId = await requireUserId()
  const fields = await normalizePost(input, website)
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .insert({ ...fields, author_id: userId, website })
    .select('*')
    .single()
  if (error) throwPostWriteError(error)
  return data as Post
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const website = currentWebsite()
  const userId = await requireUserId()
  const existing = await getMyPost(id)
  if (existing.author_id !== userId || existing.website !== website) throw new Error('Post not found')
  const fields = await normalizePost(input, website, existing)
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .update({ ...fields, website })
    .eq('id', id)
    .eq('author_id', userId)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
    .select('*')
    .single()
  if (error) throwPostWriteError(error)
  return data as Post
}

export async function deletePost(id: string): Promise<void> {
  const website = currentWebsite()
  const userId = await requireUserId()
  const supabase = await createSSRClient()
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', userId)
    .eq('website', website)
    .eq('type', BLOG_TYPE)
  if (error) throw new Error(error.message)
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
  const bodySource = input.body ?? existing?.body ?? ''
  if (bodySource != null && typeof bodySource !== 'string') throw new Error('Body must be text')
  if (typeof bodySource === 'string' && bodySource.length > 200000) throw new Error('Body is too long')

  const statusRaw = typeof input.status === 'string' ? input.status : existing?.status ?? 'draft'
  if (statusRaw !== 'draft' && statusRaw !== 'published') {
    throw new Error('Status must be draft or published')
  }

  let published_at = existing?.published_at ?? null
  if (statusRaw === 'published' && !published_at) {
    published_at = new Date().toISOString()
  }

  const sortSource = input.sort_order ?? existing?.sort_order ?? 0
  const sort_order = typeof sortSource === 'number' ? sortSource : Number(sortSource)
  if (!Number.isInteger(sort_order)) throw new Error('Sort order must be an integer')

  return {
    title,
    slug: requestedSlug,
    type: BLOG_TYPE,
    summary,
    body: bodySource ?? '',
    parent_id: null,
    status: statusRaw,
    published_at,
    video_url: optionalUrl(input.video_url ?? existing?.video_url ?? null, 'Video URL'),
    cover_image_url: optionalUrl(
      input.cover_image_url ?? existing?.cover_image_url ?? null,
      'Cover image URL'
    ),
    sort_order,
    origin: null,
  }
}

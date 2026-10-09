const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const SLUG_MIN = 2
export const SLUG_MAX = 80

/** Sites allowed by public.posts.posts_website_check. No default. */
export const POST_WEBSITES = ['edu', 'marketing-agent', 'afterallcare'] as const

export type PostWebsite = (typeof POST_WEBSITES)[number]

export const BLOG_TYPE = 'blog' as const

export const POSTS_WEBSITE_ERROR =
  'Set POSTS_WEBSITE to edu, marketing-agent, or afterallcare before reading or writing posts. This deployment has no website value.'

/** Returned for posts_root_type_slug_key. Does not name the other site, title, or id. */
export const SLUG_TAKEN_MESSAGE = 'That address is already in use. Pick another slug.'

export function isPostWebsite(value: string): value is PostWebsite {
  return (POST_WEBSITES as readonly string[]).includes(value)
}

/**
 * The deploying app passes its site via POSTS_WEBSITE. Empty and unknown
 * values are rejected. Nothing falls back to edu or marketing-agent.
 */
export function requirePostWebsite(value: string | undefined): PostWebsite {
  const website = value?.trim() ?? ''
  if (!isPostWebsite(website)) {
    throw new Error(POSTS_WEBSITE_ERROR)
  }
  return website
}

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  return slug || 'post'
}

export function isPostSlug(value: string): boolean {
  return value.length >= SLUG_MIN && value.length <= SLUG_MAX && SLUG.test(value)
}

export function isBlogType(value: string): boolean {
  return value === BLOG_TYPE
}

/** Escape ILIKE wildcards so a search for `%` is not a match-all. */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function ilikeContainsPattern(value: string): string {
  return `%${escapeIlike(value)}%`
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Map a unique-index failure to the public sentence. The raw database message
 * is not returned, so it cannot reveal another site.
 */
export function publicSlugConflictMessage(raw: string): string {
  if (raw === SLUG_TAKEN_MESSAGE || raw.includes('posts_root_type_slug_key')) {
    return SLUG_TAKEN_MESSAGE
  }
  return raw
}

export const BLOG_MEDIA_MAX_BYTES = 5 * 1024 * 1024

const BLOG_MEDIA_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function blogMediaExtension(mime: string): string | null {
  if (mime === 'image/svg+xml') return null
  return BLOG_MEDIA_EXTENSIONS[mime] ?? null
}

export function assertBlogMedia(mime: string, byteSize: number): string {
  const ext = blogMediaExtension(mime)
  if (!ext) throw new Error('Cover image must be jpeg, png, webp, or gif')
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > BLOG_MEDIA_MAX_BYTES) {
    throw new Error('Cover image must be 5 MB or smaller')
  }
  return ext
}

export function blogMediaObjectPath(website: string, userId: string, id: string, ext: string): string {
  return `${website}/${userId}/${id}.${ext}`
}

export function isLivePublication(
  status: string,
  publishedAt: string | null,
  now = Date.now()
): boolean {
  if (status !== 'published' || !publishedAt) return false
  const time = new Date(publishedAt).getTime()
  if (Number.isNaN(time)) return false
  return time <= now
}

/**
 * Draft keeps the existing timestamp. Published requires the caller to send a
 * real timestamp so a database trigger cannot fill in now().
 */
export function resolvePublication(input: {
  status: string
  publishedAt: unknown
  existingPublishedAt?: string | null
}): { status: 'draft' | 'published'; published_at: string | null } {
  if (input.status !== 'draft' && input.status !== 'published') {
    throw new Error('Status must be draft or published')
  }
  if (input.status === 'draft') {
    if (input.publishedAt === undefined) {
      return { status: 'draft', published_at: input.existingPublishedAt ?? null }
    }
    if (input.publishedAt === null || input.publishedAt === '') {
      return { status: 'draft', published_at: null }
    }
    const parsed = parseTimestamp(input.publishedAt)
    if (!parsed) throw new Error('A published post needs a valid published_at timestamp')
    return { status: 'draft', published_at: parsed }
  }
  const parsed = parseTimestamp(input.publishedAt)
  if (!parsed) throw new Error('A published post needs a valid published_at timestamp')
  return { status: 'published', published_at: parsed }
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

export function blogSlugsToRefresh(
  before: { status: string; published_at: string | null; slug: string } | null,
  after: { status: string; published_at: string | null; slug: string } | null
): string[] {
  const slugs: string[] = []
  if (before && isLivePublication(before.status, before.published_at)) slugs.push(before.slug)
  if (after && isLivePublication(after.status, after.published_at) && !slugs.includes(after.slug)) {
    slugs.push(after.slug)
  }
  return slugs
}

export function normalizeCommentBody(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Comment must be 1–2000 characters')
  const body = value.trim()
  if (body.length < 1 || body.length > 2000) throw new Error('Comment must be 1–2000 characters')
  return body
}

const NEWSLETTER_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const NEWSLETTER_OK = "You're on the list."

export function normalizeNewsletterEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Email must be an address')
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !NEWSLETTER_EMAIL.test(email)) {
    throw new Error('Email must be an address')
  }
  return email
}

export function httpStatusForPostError(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message === SLUG_TAKEN_MESSAGE) return 409
  if (message === 'Post not found' || message === 'Parent post was not found') return 404
  if (
    message.includes('must') ||
    message.includes('too long') ||
    message.startsWith('Title') ||
    message.startsWith('Slug') ||
    message.startsWith('Status') ||
    message.startsWith('Type') ||
    message.startsWith('Body') ||
    message.startsWith('Sort') ||
    message.startsWith('A post') ||
    message.startsWith('A published')
  ) {
    return 400
  }
  return 500
}

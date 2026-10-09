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

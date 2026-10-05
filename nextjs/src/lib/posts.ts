const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Sites allowed by public.posts.posts_website_check. No default. */
export const POST_WEBSITES = ['edu', 'marketing-agent', 'afterallcare'] as const

export type PostWebsite = (typeof POST_WEBSITES)[number]

export const POSTS_WEBSITE_ERROR =
  'Set POSTS_WEBSITE to edu, marketing-agent, or afterallcare before reading or writing posts. This deployment has no website value.'

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
    .slice(0, 120)
    .replace(/-+$/g, '')
  return slug || 'post'
}

export function isPostSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 120 && SLUG.test(value)
}

export function isPostType(value: string): boolean {
  return value.length >= 1 && value.length <= 40 && SLUG.test(value)
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

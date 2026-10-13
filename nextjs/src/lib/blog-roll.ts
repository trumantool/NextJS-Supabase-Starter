/** Page size for the public posts index and archive lists. */
export const BLOG_ROLL_PAGE_SIZE = 10

export type RollAuthor = {
  slug: string
  displayName: string
  title: string | null
  company: string | null
}

export const SEARCH_QUERY_MAX = 200

const WORDS_PER_MINUTE = 200

/**
 * Public post pages. overflow-x-clip keeps a long URL from widening the
 * document, which otherwise pushes the fixed header off a phone screen.
 */
export const POSTS_PAGE_FRAME = 'min-h-screen max-w-full overflow-x-clip bg-gray-50 pt-20'

export function parseSearchQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, SEARCH_QUERY_MAX)
}

/** Missing, zero, and non-integer values are the first page. */
export function parsePageQuery(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return 1
  const page = Number(raw)
  if (!Number.isSafeInteger(page)) return 1
  return page
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = BLOG_ROLL_PAGE_SIZE
): { page: number; pageCount: number; total: number; items: T[] } {
  const size = pageSize < 1 ? 1 : pageSize
  const total = items.length
  const pageCount = total === 0 ? 1 : Math.ceil(total / size)
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  const start = (current - 1) * size
  return { page: current, pageCount, total, items: items.slice(start, start + size) }
}

export function postsIndexHref(query: { q?: string; page?: number } = {}): string {
  const params = new URLSearchParams()
  const q = query.q?.trim() ?? ''
  if (q) params.set('q', q)
  if (query.page && query.page > 1) params.set('page', String(query.page))
  const search = params.toString()
  return search ? `/posts?${search}` : '/posts'
}

export function postsListHref(pathname: string, page: number): string {
  if (page <= 1) return pathname
  return `${pathname}?page=${page}`
}

function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Title and company joined with a comma.
 * Either field alone is shown by itself. Location is not part of this line.
 */
export function authorByline(
  title: string | null | undefined,
  company: string | null | undefined
): string | null {
  const parts = [trimmed(title), trimmed(company)].filter((part) => part.length > 0)
  return parts.length > 0 ? parts.join(', ') : null
}

/** Cover alt, or the post title when the author left it blank. */
export function coverAltText(alt: string | null | undefined, title: string): string {
  const value = trimmed(alt)
  return value.length > 0 ? value : title
}

const LINKEDIN_HOSTS = new Set(['www.linkedin.com', 'linkedin.com'])

/**
 * A public https LinkedIn profile, or nothing.
 * Query strings and fragments are dropped. Other hosts are rejected.
 */
export function authorSameAs(url: string | null | undefined): string | undefined {
  if (typeof url !== 'string') return undefined
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'https:') return undefined
  if (!LINKEDIN_HOSTS.has(parsed.hostname.toLowerCase())) return undefined
  if (!/^\/in\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)) return undefined
  const handle = parsed.pathname.replace(/\/$/, '')
  return `https://www.linkedin.com${handle}`
}

export function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerpt(text: string | null | undefined, max = 180): string | null {
  const value = trimmed(text).replace(/\s+/g, ' ')
  if (!value) return null
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const base = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${base.trimEnd()}…`
}

export function plainExcerpt(
  summary: string | null | undefined,
  body: string | null | undefined,
  max = 180
): string | null {
  const summaryText = trimmed(summary)
  const source = summaryText.length > 0 ? summaryText : stripMarkdown(body ?? '')
  return excerpt(source, max)
}

export function readingTimeMinutes(text: string | null | undefined): number | null {
  const words = trimmed(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  return Math.max(1, Math.round(words.length / WORDS_PER_MINUTE))
}

export function postReadingMinutes(
  summary: string | null | undefined,
  body: string | null | undefined
): number | null {
  const bodyText = trimmed(body)
  const source = bodyText.length > 0 ? stripMarkdown(bodyText) : trimmed(summary)
  return readingTimeMinutes(source)
}

export function formatPostDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

/** Supabase public objects and same-site paths can use next/image. */
export function isOptimizableCover(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

import type { PublishedPost } from '@/lib/posts-store'

/** Public origin for canonical, Open Graph, sitemap, and RSS. Empty means omit URLs. */
export function publicSiteOrigin(value: string | undefined | null): string | null {
  const raw = value?.trim() ?? ''
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return url.origin
}

export function postCanonical(origin: string | null, slug: string): string | null {
  if (!origin) return null
  return `${origin}/posts/${slug}`
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type ArticleFields = Pick<
  PublishedPost,
  'title' | 'summary' | 'slug' | 'published_at' | 'updated_at' | 'cover_image_url'
>

export function articleJsonLd(input: {
  post: ArticleFields
  authorName: string | null
  origin: string | null
}): Record<string, unknown>[] {
  const canonical = postCanonical(input.origin, input.post.slug)
  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.post.title,
    datePublished: input.post.published_at,
    dateModified: input.post.updated_at,
    author: { '@type': 'Person', name: input.authorName ?? 'Author' },
  }
  if (input.post.summary) posting.description = input.post.summary
  if (input.post.cover_image_url) posting.image = input.post.cover_image_url
  if (canonical) posting.mainEntityOfPage = canonical

  const home = input.origin ? `${input.origin}/` : '/'
  const blog = input.origin ? `${input.origin}/posts` : '/posts'
  const crumbs: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: home },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: blog },
      {
        '@type': 'ListItem',
        position: 3,
        name: input.post.title,
        ...(canonical ? { item: canonical } : {}),
      },
    ],
  }
  return [posting, crumbs]
}

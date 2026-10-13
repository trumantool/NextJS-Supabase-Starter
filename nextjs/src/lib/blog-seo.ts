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
> & {
  seo_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
}

function presentText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export function postHeadline(post: Pick<ArticleFields, 'title' | 'seo_title'>): string {
  return presentText(post.seo_title) ?? post.title
}

export function postDescription(post: Pick<ArticleFields, 'summary' | 'meta_description'>): string | null {
  return presentText(post.meta_description) ?? presentText(post.summary)
}

export function postSocialImage(
  post: Pick<ArticleFields, 'cover_image_url' | 'og_image_url'>
): string | null {
  return presentText(post.og_image_url) ?? presentText(post.cover_image_url)
}

export function articleJsonLd(input: {
  post: ArticleFields
  authorName: string | null
  origin: string | null
}): Record<string, unknown>[] {
  const canonical = postCanonical(input.origin, input.post.slug)
  const posting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: postHeadline(input.post),
    datePublished: input.post.published_at,
    dateModified: input.post.updated_at,
    author: { '@type': 'Person', name: input.authorName ?? 'Author' },
  }
  const description = postDescription(input.post)
  const image = postSocialImage(input.post)
  if (description) posting.description = description
  if (image) posting.image = image
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
        name: postHeadline(input.post),
        ...(canonical ? { item: canonical } : {}),
      },
    ],
  }
  return [posting, crumbs]
}

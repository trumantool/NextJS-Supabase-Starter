import type { MetadataRoute } from 'next'
import { listAuthorLinks, listCategoryLinks } from '@/lib/blog-taxonomy'
import { publicSiteOrigin } from '@/lib/blog-seo'
import { listPublishedPosts } from '@/lib/posts-store'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicSiteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN)
  if (!origin) return []

  const [posts, categories, authors] = await Promise.all([
    listPublishedPosts(),
    listCategoryLinks(),
    listAuthorLinks(),
  ])

  const staticPaths = ['/', '/posts']
  return [
    ...staticPaths.map((path) => ({ url: `${origin}${path}` })),
    ...posts.map((post) => ({
      url: `${origin}/posts/${post.slug}`,
      lastModified: post.updated_at,
    })),
    ...categories.map((category) => ({ url: `${origin}/posts/category/${category.slug}` })),
    ...authors.map((author) => ({ url: `${origin}/posts/author/${author.slug}` })),
  ]
}

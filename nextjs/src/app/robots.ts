import type { MetadataRoute } from 'next'
import { publicSiteOrigin } from '@/lib/blog-seo'

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN)
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/my-posts', '/admin', '/dashboard', '/documents', '/auth'],
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  }
}

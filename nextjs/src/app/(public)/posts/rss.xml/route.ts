import { listPublishedPosts } from '@/lib/posts-store'
import { publicSiteOrigin, xmlEscape } from '@/lib/blog-seo'

export const dynamic = 'force-dynamic'

export async function GET() {
  const origin = publicSiteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN)
  if (!origin) {
    return new Response('Set NEXT_PUBLIC_SITE_ORIGIN before serving the feed.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const posts = await listPublishedPosts()
  const items = posts
    .map((post) => {
      const link = `${origin}/posts/${post.slug}`
      const summary = post.summary ? `<description>${xmlEscape(post.summary)}</description>` : ''
      return `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(link)}</link><guid>${xmlEscape(link)}</guid>${
        post.published_at ? `<pubDate>${xmlEscape(new Date(post.published_at).toUTCString())}</pubDate>` : ''
      }${summary}</item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Posts</title><link>${xmlEscape(
    `${origin}/posts`
  )}</link><description>Published posts</description>${items}</channel></rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}

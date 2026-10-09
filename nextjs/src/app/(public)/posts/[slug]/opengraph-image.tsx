import { ImageResponse } from 'next/og'
import { getPublishedPostBySlug } from '@/lib/posts-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type ImageProps = { params: Promise<{ slug: string }> }

export default async function OpenGraphImage({ params }: ImageProps) {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)
  const title = post?.title ?? 'Post'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: '#111827',
          color: '#f9fafb',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 2, textTransform: 'uppercase' }}>
          Blog
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, marginTop: 16, lineHeight: 1.1 }}>
          {title}
        </div>
      </div>
    ),
    { ...size }
  )
}

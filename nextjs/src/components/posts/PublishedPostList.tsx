import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PostCoverImage } from '@/components/posts/PostCoverImage'
import {
  authorByline,
  coverAltText,
  formatPostDate,
  plainExcerpt,
  postReadingMinutes,
  type RollAuthor,
} from '@/lib/blog-roll'
import type { PublishedPost } from '@/lib/posts-store'

export type { RollAuthor }

function PostMeta({ post, author }: { post: PublishedPost; author: RollAuthor | null }) {
  const role = author ? authorByline(author.title, author.company) : null
  const minutes = postReadingMinutes(post.summary, post.body)
  const date = formatPostDate(post.published_at)
  return (
    <p className="text-sm text-muted-foreground">
      {date ? <time dateTime={post.published_at ?? undefined}>{date}</time> : null}
      {author ? (
        <>
          {date ? ' · ' : null}
          <Link href={`/posts/author/${author.slug}`} className="text-primary-700 hover:underline">
            {author.displayName}
          </Link>
          {role ? <>, {role}</> : null}
        </>
      ) : null}
      {minutes ? (
        <>
          {date || author ? ' · ' : null}
          {minutes} min read
        </>
      ) : null}
    </p>
  )
}

function cover(post: PublishedPost) {
  if (!post.cover_image_url) return null
  return { src: post.cover_image_url, alt: coverAltText(post.cover_image_alt, post.title) }
}

export function FeaturedPost({ post, author }: { post: PublishedPost; author: RollAuthor | null }) {
  const image = cover(post)
  const blurb = plainExcerpt(post.summary, post.body)
  return (
    <Card className="overflow-hidden">
      {image ? (
        <Link href={`/posts/${post.slug}`} className="block">
          <PostCoverImage src={image.src} alt={image.alt} priority />
        </Link>
      ) : null}
      <CardHeader>
        <PostMeta post={post} author={author} />
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
          <Link href={`/posts/${post.slug}`} className="hover:text-primary-700">
            {post.title}
          </Link>
        </h2>
      </CardHeader>
      {blurb ? (
        <CardContent>
          <p className="text-gray-700">{blurb}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function PostCard({ post, author }: { post: PublishedPost; author: RollAuthor | null }) {
  const image = cover(post)
  const blurb = plainExcerpt(post.summary, post.body)
  return (
    <li>
      <Card className="overflow-hidden">
        {image ? (
          <Link href={`/posts/${post.slug}`} className="block">
            <PostCoverImage src={image.src} alt={image.alt} />
          </Link>
        ) : null}
        <CardHeader>
          <PostMeta post={post} author={author} />
          <h2 className="text-2xl font-semibold text-gray-900">
            <Link href={`/posts/${post.slug}`} className="hover:text-primary-700">
              {post.title}
            </Link>
          </h2>
        </CardHeader>
        {blurb ? (
          <CardContent>
            <p className="text-gray-700">{blurb}</p>
          </CardContent>
        ) : null}
      </Card>
    </li>
  )
}

export function PublishedPostList({
  posts,
  authors = {},
  empty,
}: {
  posts: PublishedPost[]
  authors?: Record<string, RollAuthor>
  empty: string
}) {
  if (posts.length === 0) {
    if (!empty) return null
    return <p className="text-gray-600">{empty}</p>
  }
  return (
    <ul className="space-y-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          author={post.author_id ? authors[post.author_id] ?? null : null}
        />
      ))}
    </ul>
  )
}

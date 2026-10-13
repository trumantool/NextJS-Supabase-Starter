import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'
import { CommentForm } from '@/components/posts/CommentForm'
import { PostCoverImage } from '@/components/posts/PostCoverImage'
import { PostsPageFrame } from '@/components/posts/PostsPageFrame'
import { listVisibleComments } from '@/lib/blog-comments'
import { authorByline, coverAltText, formatPostDate, postReadingMinutes } from '@/lib/blog-roll'
import { loadPublishedArticle } from '@/lib/blog-taxonomy'
import { articleJsonLd, postCanonical, postDescription, postHeadline, postSocialImage, publicSiteOrigin } from '@/lib/blog-seo'
import { blogBodyHtml } from '@/lib/blog/render-body'
import { youtubeNocookieSrc, youtubeVideoId } from '@/lib/blog/youtube'
import { settlePublicBlog } from '@/lib/posts'
import { createSSRClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await settlePublicBlog('article metadata', () => loadPublishedArticle(slug), null)
  if (!article) return { title: 'Post' }
  const { post } = article
  const origin = publicSiteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN)
  const canonical = postCanonical(origin, post.slug)
  const title = postHeadline(post)
  const description = postDescription(post) ?? undefined
  const image = postSocialImage(post)
  const images = image ? [image] : undefined
  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: 'article',
      title,
      description,
      ...(canonical ? { url: canonical } : {}),
      publishedTime: post.published_at ?? undefined,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  }
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const article = await settlePublicBlog('article', () => loadPublishedArticle(slug), null)
  if (!article) notFound()
  const { post, categories, tags, author, related } = article
  const origin = publicSiteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN)
  const jsonLd = articleJsonLd({ post, authorName: author?.display_name ?? null, origin })
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const comments = await settlePublicBlog('comments', () => listVisibleComments(post.id), [])

  const role = author ? authorByline(author.title, author.company) : null
  const date = formatPostDate(post.published_at)
  const minutes = postReadingMinutes(post.summary, post.body)
  const html = blogBodyHtml(post.body_doc)
  const videoId = youtubeVideoId(post.video_url)

  return (
    <PostsPageFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="[overflow-wrap:anywhere]">
        <Link href="/posts" className="text-sm text-primary-700 hover:underline">
          All posts
        </Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">{post.title}</h1>
        {date || author || minutes ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {date ? <time dateTime={post.published_at ?? undefined}>{date}</time> : null}
            {author ? (
              <>
                {date ? ' · ' : null}
                <Link href={`/posts/author/${author.slug}`} className="text-primary-700 hover:underline">
                  {author.display_name}
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
        ) : null}
        {post.summary ? <p className="mt-4 text-xl text-gray-600">{post.summary}</p> : null}
        {categories.length > 0 || tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/posts/category/${category.slug}`}
                className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200 hover:text-primary-700"
              >
                {category.name}
              </Link>
            ))}
            {tags.map((tag) => (
              <Link key={tag.slug} href={`/posts/tag/${tag.slug}`} className="text-primary-700 hover:underline">
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}
        {post.cover_image_url ? (
          <div className="mt-8 overflow-hidden rounded-lg">
            <PostCoverImage
              src={post.cover_image_url}
              alt={coverAltText(post.cover_image_alt, post.title)}
              priority
            />
          </div>
        ) : null}
        {html ? (
          <div
            className="prose prose-gray mt-8 max-w-none [overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="prose prose-gray mt-8 max-w-none [overflow-wrap:anywhere]">
            <ReactMarkdown>{post.body ?? ''}</ReactMarkdown>
          </div>
        )}
        {videoId ? (
          <div className="mt-8 aspect-video w-full max-w-full overflow-hidden">
            <iframe
              src={youtubeNocookieSrc(videoId)}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="h-full w-full max-w-full"
            />
          </div>
        ) : post.video_url ? (
          <p className="mt-8">
            <a href={post.video_url} className="text-primary-700 hover:underline">
              Video
            </a>
          </p>
        ) : null}
        {related.length > 0 ? (
          <aside className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900">Related</h2>
            <ul className="mt-3 space-y-2">
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/posts/${item.slug}`} className="text-primary-700 hover:underline">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
          {comments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No comments yet.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-white px-4 py-3 ring-1 ring-gray-200">
                  <p className="whitespace-pre-wrap text-gray-900">{comment.body}</p>
                  <p className="mt-2 text-xs text-gray-500">{comment.created_at.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          )}
          {user ? (
            <CommentForm slug={post.slug} />
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              <Link href="/auth/login" className="hover:underline">
                Sign in
              </Link>{' '}
              to comment.
            </p>
          )}
        </section>
      </article>
    </PostsPageFrame>
  )
}

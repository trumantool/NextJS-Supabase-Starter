import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getPublishedPostBySlug } from '@/lib/posts-store'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)
  if (!post) return { title: 'Post' }
  return { title: post.title, description: post.summary ?? undefined }
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPublishedPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/posts" className="text-sm text-gray-600 hover:underline">
          All posts
        </Link>
        <p className="mt-6 text-xs uppercase tracking-wide text-gray-500">{post.type}</p>
        <h1 className="mt-2 text-4xl font-bold text-gray-900">{post.title}</h1>
        {post.summary ? <p className="mt-4 text-xl text-gray-600">{post.summary}</p> : null}
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover_image_url} alt="" className="mt-8 w-full rounded-lg" />
        ) : null}
        <div className="prose prose-gray mt-8 max-w-none">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>
        {post.video_url ? (
          <p className="mt-8">
            <a href={post.video_url} className="text-primary-700 hover:underline">
              Video
            </a>
          </p>
        ) : null}
      </article>
    </div>
  )
}

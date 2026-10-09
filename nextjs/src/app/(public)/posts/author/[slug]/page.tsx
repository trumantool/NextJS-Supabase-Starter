import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublishedPostList } from '@/components/posts/PublishedPostList'
import { listPostsForAuthor } from '@/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const result = await listPostsForAuthor(slug)
  if (!result) return { title: 'Author' }
  return { title: result.author.display_name, description: result.author.bio ?? undefined }
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params
  const result = await listPostsForAuthor(slug)
  if (!result) notFound()

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/posts" className="text-sm text-gray-600 hover:underline">
          All posts
        </Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">{result.author.display_name}</h1>
        {result.author.bio ? <p className="mt-4 text-lg text-gray-600">{result.author.bio}</p> : null}
        <PublishedPostList posts={result.posts} />
      </div>
    </div>
  )
}

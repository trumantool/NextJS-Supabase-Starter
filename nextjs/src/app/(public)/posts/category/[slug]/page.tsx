import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublishedPostList } from '@/components/posts/PublishedPostList'
import { listPostsForCategory } from '@/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const result = await listPostsForCategory(slug)
  if (!result) return { title: 'Category' }
  return { title: result.name, description: `Posts in ${result.name}` }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const result = await listPostsForCategory(slug)
  if (!result) notFound()

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/posts" className="text-sm text-gray-600 hover:underline">
          All posts
        </Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">{result.name}</h1>
        <PublishedPostList posts={result.posts} />
      </div>
    </div>
  )
}

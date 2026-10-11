import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublishedPostList } from '@/components/posts/PublishedPostList'
import { PostsPageFrame } from '@/components/posts/PostsPageFrame'
import { PostsPagination } from '@/components/posts/PostsPagination'
import { paginate, parsePageQuery } from '@/lib/blog-roll'
import { authorsForUserIds, listPostsForCategory } from '@/lib/blog-taxonomy'
import { settlePublicBlog } from '@/lib/posts'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const result = await settlePublicBlog('category metadata', () => listPostsForCategory(slug), null)
  if (!result) return { title: 'Category' }
  return { title: result.name, description: `Posts in ${result.name}` }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const result = await settlePublicBlog('category', () => listPostsForCategory(slug), null)
  if (!result) notFound()
  const paged = paginate(result.posts, parsePageQuery(query.page))
  const authors = await settlePublicBlog(
    'category authors',
    () => authorsForUserIds(paged.items.flatMap((post) => (post.author_id ? [post.author_id] : []))),
    {}
  )

  return (
    <PostsPageFrame>
      <Link href="/posts" className="text-sm text-primary-700 hover:underline">
        All posts
      </Link>
      <h1 className="mt-6 text-4xl font-bold text-gray-900">{result.name}</h1>
      <div className="mt-8">
        <PublishedPostList posts={paged.items} authors={authors} empty="No posts in this category yet." />
      </div>
      <PostsPagination pathname={`/posts/category/${slug}`} page={paged.page} pageCount={paged.pageCount} />
    </PostsPageFrame>
  )
}

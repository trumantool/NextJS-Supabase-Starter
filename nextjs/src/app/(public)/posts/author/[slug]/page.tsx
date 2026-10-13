import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthorHeading } from '@/components/posts/AuthorHeading'
import { PublishedPostList } from '@/components/posts/PublishedPostList'
import { PostsPageFrame } from '@/components/posts/PostsPageFrame'
import { PostsPagination } from '@/components/posts/PostsPagination'
import { authorSameAs, paginate, parsePageQuery } from '@/lib/blog-roll'
import { authorsForUserIds, listPostsForAuthor } from '@/lib/blog-taxonomy'
import { settlePublicBlog } from '@/lib/posts'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const result = await settlePublicBlog('author metadata', () => listPostsForAuthor(slug), null)
  if (!result) return { title: 'Author' }
  return {
    title: result.author.display_name,
    description: result.author.bio ?? `Posts by ${result.author.display_name}`,
  }
}

export default async function AuthorPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const result = await settlePublicBlog('author', () => listPostsForAuthor(slug), null)
  if (!result) notFound()
  const paged = paginate(result.posts, parsePageQuery(query.page))
  const authors = await settlePublicBlog(
    'author roll',
    () => authorsForUserIds(paged.items.flatMap((post) => (post.author_id ? [post.author_id] : []))),
    {}
  )
  const { author } = result

  return (
    <PostsPageFrame>
      <Link href="/posts" className="text-sm text-primary-700 hover:underline">
        All posts
      </Link>
      <div className="mt-6">
        <AuthorHeading
          displayName={author.display_name}
          title={author.title}
          company={author.company}
          location={author.location}
          bio={author.bio}
          linkedin={authorSameAs(author.linkedin_url)}
        />
      </div>
      <div className="mt-8">
        <PublishedPostList posts={paged.items} authors={authors} empty="No published posts yet." />
      </div>
      <PostsPagination pathname={`/posts/author/${slug}`} page={paged.page} pageCount={paged.pageCount} />
    </PostsPageFrame>
  )
}

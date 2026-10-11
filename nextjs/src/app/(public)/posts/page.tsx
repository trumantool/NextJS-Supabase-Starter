import Link from 'next/link'
import { FeaturedPost, PublishedPostList } from '@/components/posts/PublishedPostList'
import { PostsPageFrame } from '@/components/posts/PostsPageFrame'
import { PostsPagination } from '@/components/posts/PostsPagination'
import { PostsSidebar } from '@/components/posts/PostsSidebar'
import { SearchForm } from '@/components/posts/SearchForm'
import { paginate, parsePageQuery, parseSearchQuery } from '@/lib/blog-roll'
import {
  authorsForUserIds,
  listAuthorLinks,
  listCategoryLinks,
  listTagLinks,
  newsletterBlockAvailable,
} from '@/lib/blog-taxonomy'
import { settlePublicBlog } from '@/lib/posts'
import { listPublishedPosts, searchPublishedPosts } from '@/lib/posts-store'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Blog',
  description: 'Published posts.',
}

type PageProps = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = parseSearchQuery(params.q)
  const requestedPage = parsePageQuery(params.page)
  const [posts, categories, tags, authorLinks, showNewsletter] = await Promise.all([
    settlePublicBlog('index', () => (query ? searchPublishedPosts(query) : listPublishedPosts()), []),
    settlePublicBlog('categories', () => listCategoryLinks(), []),
    settlePublicBlog('tags', () => listTagLinks(), []),
    settlePublicBlog('authors', () => listAuthorLinks(), []),
    settlePublicBlog('newsletter', () => newsletterBlockAvailable(), false),
  ])
  const rollAuthors = await settlePublicBlog(
    'roll authors',
    () => authorsForUserIds(posts.flatMap((post) => (post.author_id ? [post.author_id] : []))),
    {}
  )
  const paged = paginate(posts, requestedPage)
  const lead = !query && paged.page === 1 ? (paged.items[0] ?? null) : null
  const cards = lead ? paged.items.slice(1) : paged.items
  const empty = query ? 'No posts match that search.' : 'No posts yet.'

  return (
    <PostsPageFrame width="6xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <header>
            <h1 className="text-4xl font-bold text-gray-900">Blog</h1>
            <p className="mt-4 text-lg text-gray-600">Published writing from this site.</p>
          </header>
          <SearchForm query={query} />
          {query ? (
            <p className="text-sm text-gray-600">
              Results for “{query}”.{' '}
              <Link href="/posts" className="text-primary-700 hover:underline">
                Clear search
              </Link>
            </p>
          ) : null}
          {lead ? (
            <FeaturedPost
              post={lead}
              author={lead.author_id ? (rollAuthors[lead.author_id] ?? null) : null}
            />
          ) : null}
          <PublishedPostList posts={cards} authors={rollAuthors} empty={lead ? '' : empty} />
          <PostsPagination pathname="/posts" query={query} page={paged.page} pageCount={paged.pageCount} />
        </div>
        <div className="order-1 lg:order-2">
          <PostsSidebar
            categories={categories}
            tags={tags}
            authors={authorLinks}
            showNewsletter={showNewsletter}
          />
        </div>
      </div>
    </PostsPageFrame>
  )
}

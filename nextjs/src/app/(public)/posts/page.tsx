import Link from 'next/link'
import { NewsletterForm } from '@/components/posts/NewsletterForm'
import { PublishedPostList } from '@/components/posts/PublishedPostList'
import { listAuthorLinks, listCategoryLinks } from '@/lib/blog-taxonomy'
import { listPublishedPosts, searchPublishedPosts } from '@/lib/posts-store'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Posts',
  description: 'Published posts.',
}

type PageProps = { searchParams: Promise<{ q?: string }> }

export default async function PostsPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const [posts, categories, authors] = await Promise.all([
    query ? searchPublishedPosts(query) : listPublishedPosts(),
    listCategoryLinks(),
    listAuthorLinks(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900">Posts</h1>
        <p className="mt-4 text-lg text-gray-600">Published writing from this site.</p>
        <form action="/posts" method="get" className="mt-8 flex gap-2">
          <label htmlFor="post-search" className="sr-only">
            Search posts
          </label>
          <input
            id="post-search"
            name="q"
            defaultValue={query}
            placeholder="Search titles and summaries"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white">
            Search
          </button>
        </form>
        {query ? (
          <p className="mt-4 text-sm text-gray-600">
            Results for “{query}”. <Link href="/posts" className="underline">Clear</Link>
          </p>
        ) : null}
        {categories.length > 0 ? (
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Categories">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/posts/category/${category.slug}`}
                className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200 hover:text-primary-700"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {authors.length > 0 ? (
          <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Authors">
            {authors.map((author) => (
              <Link key={author.slug} href={`/posts/author/${author.slug}`} className="text-gray-600 hover:underline">
                {author.name}
              </Link>
            ))}
          </nav>
        ) : null}
        <PublishedPostList posts={posts} />
        <NewsletterForm />
      </div>
    </div>
  )
}

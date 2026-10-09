import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { loadPublishedArticle } from '@/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const article = await loadPublishedArticle(slug)
  if (!article) return { title: 'Post' }
  return { title: article.post.title, description: article.post.summary ?? undefined }
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const article = await loadPublishedArticle(slug)
  if (!article) notFound()
  const { post, categories, tags, author, related } = article

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href="/posts" className="text-sm text-gray-600 hover:underline">
          All posts
        </Link>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">{post.title}</h1>
        {author ? (
          <p className="mt-3 text-sm text-gray-600">
            <Link href={`/posts/author/${author.slug}`} className="hover:underline">
              {author.display_name}
            </Link>
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
              <Link key={tag.slug} href={`/posts/tag/${tag.slug}`} className="text-gray-600 hover:underline">
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover_image_url} alt="" className="mt-8 w-full rounded-lg" />
        ) : null}
        <div className="prose prose-gray mt-8 max-w-none">
          <ReactMarkdown>{post.body ?? ''}</ReactMarkdown>
        </div>
        {post.video_url ? (
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
      </article>
    </div>
  )
}

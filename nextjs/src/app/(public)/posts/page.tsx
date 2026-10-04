import Link from 'next/link'
import { listPublishedPosts } from '@/lib/posts-store'

export const metadata = {
  title: 'Posts',
  description: 'Published posts.',
}

export default async function PostsPage() {
  const posts = await listPublishedPosts()

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900">Posts</h1>
        <p className="mt-4 text-lg text-gray-600">Published writing from this site.</p>
        {posts.length === 0 ? (
          <p className="mt-10 text-gray-600">Nothing published yet.</p>
        ) : (
          <ul className="mt-10 space-y-6">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border bg-white p-6">
                <p className="text-xs uppercase tracking-wide text-gray-500">{post.type}</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  <Link href={`/posts/${post.slug}`} className="text-gray-900 hover:text-primary-700">
                    {post.title}
                  </Link>
                </h2>
                {post.summary ? <p className="mt-2 text-gray-600">{post.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

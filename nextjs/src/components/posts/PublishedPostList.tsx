import Link from 'next/link'
import type { PublishedPost } from '@/lib/posts-store'

export function PublishedPostList({ posts }: { posts: PublishedPost[] }) {
  if (posts.length === 0) {
    return <p className="mt-10 text-gray-600">Nothing published yet.</p>
  }
  return (
    <ul className="mt-10 space-y-6">
      {posts.map((post) => (
        <li key={post.id} className="rounded-lg border bg-white p-6">
          <h2 className="text-2xl font-semibold">
            <Link href={`/posts/${post.slug}`} className="text-gray-900 hover:text-primary-700">
              {post.title}
            </Link>
          </h2>
          {post.summary ? <p className="mt-2 text-gray-600">{post.summary}</p> : null}
        </li>
      ))}
    </ul>
  )
}

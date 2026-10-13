import { POSTS_PAGE_FRAME } from '@/lib/blog-roll'

export default function PostsLoading() {
  return (
    <div className={POSTS_PAGE_FRAME}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  )
}

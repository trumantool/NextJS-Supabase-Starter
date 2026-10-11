'use client'

import { Button } from '@/components/ui/button'
import { POSTS_PAGE_FRAME } from '@/lib/blog-roll'

export default function PostsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={POSTS_PAGE_FRAME}>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-gray-900">Posts could not be loaded.</h1>
        <Button type="button" variant="outline" onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  )
}

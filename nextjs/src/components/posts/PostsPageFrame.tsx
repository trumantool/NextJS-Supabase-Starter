import type { ReactNode } from 'react'
import { POSTS_PAGE_FRAME } from '@/lib/blog-roll'

export function PostsPageFrame({
  children,
  width = '3xl',
}: {
  children: ReactNode
  width?: '3xl' | '6xl'
}) {
  const max = width === '6xl' ? 'max-w-6xl' : 'max-w-3xl'
  return (
    <div className={POSTS_PAGE_FRAME}>
      <div className={`mx-auto ${max} px-4 py-12 sm:px-6 lg:px-8`}>{children}</div>
    </div>
  )
}

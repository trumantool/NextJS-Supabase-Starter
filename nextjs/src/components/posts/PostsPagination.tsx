import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { postsIndexHref, postsListHref } from '@/lib/blog-roll'

export function PostsPagination({
  pathname,
  query = '',
  page,
  pageCount,
}: {
  pathname: string
  query?: string
  page: number
  pageCount: number
}) {
  if (pageCount <= 1) return null
  const href = (nextPage: number) =>
    pathname === '/posts' ? postsIndexHref({ q: query, page: nextPage }) : postsListHref(pathname, nextPage)
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button variant="outline" asChild>
          <Link href={href(page - 1)}>Previous</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Previous
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Button variant="outline" asChild>
          <Link href={href(page + 1)}>Next</Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
        </Button>
      )}
    </nav>
  )
}

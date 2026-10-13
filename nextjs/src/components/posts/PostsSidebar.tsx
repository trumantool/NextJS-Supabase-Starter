import Link from 'next/link'
import type { TermLink } from '@/lib/blog-taxonomy'
import { NewsletterForm } from '@/components/posts/NewsletterForm'

export function TermFilters({
  categories,
  tags,
  authors,
}: {
  categories: TermLink[]
  tags: TermLink[]
  authors: TermLink[]
}) {
  if (categories.length === 0 && tags.length === 0 && authors.length === 0) return null
  return (
    <div className="space-y-6">
      <TermNav label="Categories" items={categories} hrefFor={(slug) => `/posts/category/${slug}`} />
      <TermNav label="Tags" items={tags} hrefFor={(slug) => `/posts/tag/${slug}`} />
      <TermNav label="Authors" items={authors} hrefFor={(slug) => `/posts/author/${slug}`} />
    </div>
  )
}

function TermNav({
  label,
  items,
  hrefFor,
}: {
  label: string
  items: TermLink[]
  hrefFor: (slug: string) => string
}) {
  if (items.length === 0) return null
  return (
    <nav aria-label={label}>
      <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={hrefFor(item.slug)}
              className="inline-block rounded-full bg-white px-3 py-1 text-sm text-gray-700 ring-1 ring-gray-200 hover:text-primary-700"
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PostsSidebar({
  categories,
  tags,
  authors,
  showNewsletter,
}: {
  categories: TermLink[]
  tags: TermLink[]
  authors: TermLink[]
  showNewsletter: boolean
}) {
  return (
    <aside className="space-y-8">
      <TermFilters categories={categories} tags={tags} authors={authors} />
      {showNewsletter ? <NewsletterForm /> : null}
    </aside>
  )
}

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SearchForm({ query }: { query: string }) {
  return (
    <form action="/posts" method="get" className="flex gap-2">
      <label className="sr-only" htmlFor="post-search">
        Search posts
      </label>
      <Input
        id="post-search"
        name="q"
        defaultValue={query}
        placeholder="Search titles and summaries"
      />
      <Button type="submit">Search</Button>
    </form>
  )
}

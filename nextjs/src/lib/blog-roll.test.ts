import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BLOG_ROLL_PAGE_SIZE,
  authorByline,
  authorSameAs,
  coverAltText,
  excerpt,
  formatPostDate,
  isOptimizableCover,
  paginate,
  parsePageQuery,
  parseSearchQuery,
  plainExcerpt,
  postReadingMinutes,
  postsIndexHref,
  postsListHref,
  readingTimeMinutes,
} from './blog-roll.ts'

describe('blog roll query params', () => {
  it('trims search text and ignores a missing value', () => {
    assert.equal(parseSearchQuery(undefined), '')
    assert.equal(parseSearchQuery('  guides  '), 'guides')
    assert.equal(parseSearchQuery(['  first ', 'second']), 'first')
    assert.equal(parseSearchQuery('x'.repeat(250)).length, 200)
  })

  it('reads a positive page and treats junk as page 1', () => {
    assert.equal(parsePageQuery(undefined), 1)
    assert.equal(parsePageQuery('3'), 3)
    assert.equal(parsePageQuery(['4', '9']), 4)
    assert.equal(parsePageQuery('0'), 1)
    assert.equal(parsePageQuery('-2'), 1)
    assert.equal(parsePageQuery('01'), 1)
    assert.equal(parsePageQuery('1.5'), 1)
    assert.equal(parsePageQuery('nope'), 1)
  })

  it('keeps search and page on the index URL', () => {
    assert.equal(postsIndexHref(), '/posts')
    assert.equal(postsIndexHref({ q: '  ' }), '/posts')
    assert.equal(postsIndexHref({ q: 'ai', page: 1 }), '/posts?q=ai')
    assert.equal(postsIndexHref({ q: 'ai', page: 2 }), '/posts?q=ai&page=2')
    assert.equal(postsIndexHref({ page: 2 }), '/posts?page=2')
    assert.equal(postsListHref('/posts/tag/notes', 1), '/posts/tag/notes')
    assert.equal(postsListHref('/posts/tag/notes', 3), '/posts/tag/notes?page=3')
  })
})

describe('blog roll pagination', () => {
  const items = Array.from({ length: 25 }, (_, index) => index)

  it('slices a full middle page', () => {
    const page = paginate(items, 2, 10)
    assert.equal(page.total, 25)
    assert.equal(page.pageCount, 3)
    assert.equal(page.page, 2)
    assert.deepEqual(page.items, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  })

  it('clamps a page past the end and an empty list', () => {
    const last = paginate(items, 99, BLOG_ROLL_PAGE_SIZE)
    assert.equal(last.page, 3)
    assert.deepEqual(last.items, [20, 21, 22, 23, 24])
    const empty = paginate([], 4, 10)
    assert.deepEqual(empty, { page: 1, pageCount: 1, total: 0, items: [] })
  })
})

describe('blog roll text', () => {
  it('joins a title and company and omits blanks', () => {
    assert.equal(authorByline('Editor', 'Example Co'), 'Editor, Example Co')
    assert.equal(authorByline('Editor', '  '), 'Editor')
    assert.equal(authorByline(null, 'Example Co'), 'Example Co')
    assert.equal(authorByline('  ', null), null)
  })

  it('falls back to the post title for a blank cover alt', () => {
    assert.equal(coverAltText('  Desk  ', 'Hours'), 'Desk')
    assert.equal(coverAltText(null, 'Hours'), 'Hours')
    assert.equal(coverAltText('', 'Hours'), 'Hours')
  })

  it('keeps a LinkedIn profile and drops other URLs', () => {
    assert.equal(
      authorSameAs('https://www.linkedin.com/in/ada-lovelace?trk=public'),
      'https://www.linkedin.com/in/ada-lovelace'
    )
    assert.equal(authorSameAs('https://example.com/in/ada'), undefined)
    assert.equal(authorSameAs('http://www.linkedin.com/in/ada'), undefined)
  })

  it('excerpts on a word boundary and prefers the summary', () => {
    assert.equal(excerpt('Short note'), 'Short note')
    assert.equal(excerpt(''), null)
    const long = 'alpha beta gamma delta'
    assert.equal(excerpt(long, 12), 'alpha beta…')
    assert.equal(plainExcerpt('Summary line', 'Body that is longer'), 'Summary line')
    assert.equal(plainExcerpt('  ', 'Hello [world](https://example.com)'), 'Hello world')
  })

  it('estimates reading time from words', () => {
    assert.equal(readingTimeMinutes(''), null)
    assert.equal(readingTimeMinutes('one two'), 1)
    assert.equal(readingTimeMinutes(Array.from({ length: 200 }, () => 'word').join(' ')), 1)
    assert.equal(readingTimeMinutes(Array.from({ length: 300 }, () => 'word').join(' ')), 2)
    assert.equal(postReadingMinutes(null, '# Title\n\none two three'), 1)
    assert.equal(postReadingMinutes('only summary', '   '), 1)
  })

  it('formats a published date in UTC', () => {
    assert.equal(formatPostDate('2026-10-09T15:15:18Z'), 'Oct 9, 2026')
    assert.equal(formatPostDate('not-a-date'), '')
    assert.equal(formatPostDate(null), '')
  })
})

describe('cover image hosts', () => {
  it('optimizes local paths and public Supabase objects only', () => {
    assert.equal(isOptimizableCover('/covers/a.jpg'), true)
    assert.equal(isOptimizableCover('//evil.example/a.jpg'), false)
    assert.equal(
      isOptimizableCover('https://abc.supabase.co/storage/v1/object/public/blog-media/a.jpg'),
      true
    )
    assert.equal(
      isOptimizableCover('https://abc.supabase.co/storage/v1/object/sign/blog-media/a.jpg'),
      false
    )
    assert.equal(isOptimizableCover('https://example.com/a.jpg'), false)
    assert.equal(isOptimizableCover('not a url'), false)
  })
})

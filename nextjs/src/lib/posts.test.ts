import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isHttpUrl,
  isPostSlug,
  isPostType,
  isPostWebsite,
  POSTS_WEBSITE_ERROR,
  requirePostWebsite,
  slugifyTitle,
} from './posts.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sqlFiles = [
  join(root, 'supabase/schema.sql'),
  join(root, 'supabase/migrations/20261003120000_posts_stripe_token_ledger.sql'),
]

describe('slugifyTitle', () => {
  it('builds a lowercase hyphenated slug', () => {
    assert.equal(slugifyTitle('Hello, World!'), 'hello-world')
    assert.equal(slugifyTitle('  Café Notes  '), 'cafe-notes')
    assert.equal(slugifyTitle('***'), 'post')
  })
})

describe('post validators', () => {
  it('accepts slugs and types within length', () => {
    assert.equal(isPostSlug('hello-world'), true)
    assert.equal(isPostSlug('Hello'), false)
    assert.equal(isPostSlug(''), false)
    assert.equal(isPostType('post'), true)
    assert.equal(isPostType('a'.repeat(41)), false)
  })

  it('accepts only the posts_website_check values', () => {
    assert.equal(requirePostWebsite('edu'), 'edu')
    assert.equal(requirePostWebsite(' marketing-agent '), 'marketing-agent')
    assert.equal(requirePostWebsite('afterallcare'), 'afterallcare')
    assert.equal(isPostWebsite('edu'), true)
    for (const value of [undefined, '', '  ', 'EDU', 'blog', 'marketing']) {
      assert.throws(() => requirePostWebsite(value), { message: POSTS_WEBSITE_ERROR })
    }
  })

  it('accepts only http(s) URLs', () => {
    assert.equal(isHttpUrl('https://example.com/a'), true)
    assert.equal(isHttpUrl('http://example.com'), true)
    assert.equal(isHttpUrl('javascript:alert(1)'), false)
    assert.equal(isHttpUrl('not a url'), false)
  })
})

describe('posts website schema', () => {
  for (const file of sqlFiles) {
    it(`${file} creates website, posts_website_check, and posts_website_type_status_idx`, () => {
      const sql = readFileSync(file, 'utf8')
      assert.match(sql, /website text NOT NULL,/)
      assert.doesNotMatch(sql, /website text NOT NULL DEFAULT/)
      assert.match(
        sql,
        /CONSTRAINT posts_website_check CHECK \(\s*website IN \('edu', 'marketing-agent', 'afterallcare'\)\s*\)/
      )
      assert.match(
        sql,
        /CREATE INDEX IF NOT EXISTS posts_website_type_status_idx\s+ON public\.posts \(website, type, status\);/
      )
      assert.equal(sql.includes("DEFAULT 'edu'"), false)
      assert.equal(sql.includes("website = 'edu'"), false)
    })
  }

  it('post reads filter website and writes set it from POSTS_WEBSITE', () => {
    const store = readFileSync(join(root, 'nextjs/src/lib/posts-store.ts'), 'utf8')
    assert.match(store, /requirePostWebsite\(process\.env\.POSTS_WEBSITE\)/)
    assert.equal(store.includes("'edu'"), false)
    assert.equal(store.includes('marketing-agent'), false)
    const queries = store.split(".from('posts')").slice(1)
    assert.equal(queries.length, 9)
    for (const query of queries) {
      assert.match(query, /website/)
    }
  })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'
import {
  httpStatusForPostError,
  ilikeContainsPattern,
  isBlogType,
  isHttpUrl,
  isPostSlug,
  isPostWebsite,
  POSTS_WEBSITE_ERROR,
  publicSlugConflictMessage,
  requirePostWebsite,
  SLUG_TAKEN_MESSAGE,
  slugifyTitle,
} from './posts.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sqlFiles = [
  join(root, 'supabase/schema.sql'),
  join(root, 'supabase/migrations/20261003120000_posts_stripe_token_ledger.sql'),
]

describe('slugifyTitle', () => {
  it('builds a lowercase hyphenated slug and slices to 80', () => {
    assert.equal(slugifyTitle('Hello, World!'), 'hello-world')
    assert.equal(slugifyTitle('  Café Notes  '), 'cafe-notes')
    assert.equal(slugifyTitle('***'), 'post')
    const long = slugifyTitle(`${'word '.repeat(40)}end`)
    assert.ok(long.length <= 80)
    assert.equal(long.endsWith('-'), false)
  })
})

describe('post validators', () => {
  it('accepts blog slugs of length 2–80 and rejects the rest', () => {
    assert.equal(isPostSlug('hello-world'), true)
    assert.equal(isPostSlug('hours-and-payment'), true)
    assert.equal(isPostSlug('Hello'), false)
    assert.equal(isPostSlug(''), false)
    assert.equal(isPostSlug('a'), false)
    assert.equal(isPostSlug('a'.repeat(81)), false)
    assert.equal(isBlogType('blog'), true)
    assert.equal(isBlogType('post'), false)
    assert.equal(isBlogType('course'), false)
  })

  it('maps a root slug clash to a generic 409', () => {
    const raw =
      'duplicate key value violates unique constraint "posts_root_type_slug_key"'
    const mapped = publicSlugConflictMessage(`${raw} afterallcare hours-and-payment`)
    assert.equal(mapped, SLUG_TAKEN_MESSAGE)
    assert.equal(mapped.includes('afterallcare'), false)
    assert.equal(httpStatusForPostError(mapped), 409)
    assert.equal(SLUG_TAKEN_MESSAGE, 'That address is already in use. Pick another slug.')
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
      assert.equal(sql.includes("DEFAULT 'post'"), false)
      assert.equal(sql.includes('UNIQUE (slug)'), false)
      assert.match(sql, /posts_root_type_slug_key/)
      assert.match(sql, /posts_lesson_parent_slug_key/)
      assert.match(sql, /posts_slug_length_check/)
      assert.match(sql, /posts_parent_by_type_check/)
      assert.match(sql, /posts_origin_owner_check/)
      assert.match(sql, /posts_type_check/)
      assert.equal(/CREATE POLICY "Anyone can read published posts"/.test(sql), false)
      const policyAt = sql.indexOf('CREATE POLICY posts_select_published_blog')
      assert.notEqual(policyAt, -1)
      const policy = sql.slice(policyAt, policyAt + 450)
      assert.match(policy, /type = 'blog'/)
      assert.match(policy, /published_at <= now\(\)/)
      assert.equal(policy.includes("USING (status = 'published')"), false)
      assert.equal(sql.includes('glplvrljdgowcwuubkau'), true)
    })
  }

  it('post reads filter website and writes set it from POSTS_WEBSITE', () => {
    const store = readFileSync(join(root, 'nextjs/src/lib/posts-store.ts'), 'utf8')
    assert.match(store, /requirePostWebsite\(process\.env\.POSTS_WEBSITE\)/)
    assert.match(store, /type: BLOG_TYPE/)
    assert.equal(store.includes("DEFAULT 'post'"), false)
    assert.equal(store.includes("?? 'post'"), false)
    assert.equal(store.includes("'edu'"), false)
    assert.equal(store.includes('marketing-agent'), false)
    const queries = store.split(".from('posts')").slice(1)
    let rootSlugPrechecks = 0
    for (const query of queries) {
      const chain = query.split('if (error)')[0]
      if (chain.includes(".is('parent_id', null)")) {
        assert.match(chain, /\.eq\('type', 'blog'\)/)
        assert.doesNotMatch(chain, /\.eq\('website'/)
        rootSlugPrechecks += 1
        continue
      }
      assert.match(chain, /website/)
    }
    assert.equal(rootSlugPrechecks, 1)
    assert.match(store, /ilikeContainsPattern/)
    assert.match(store, /\.eq\('status', 'published'\)/)
    assert.match(store, /\.lte\('published_at'/)
  })
})

describe('search escape', () => {
  it('does not turn a percent sign into a match-all pattern', () => {
    const pattern = ilikeContainsPattern('%')
    assert.equal(pattern, '%\\%%')
    assert.notEqual(pattern, '%%')
    assert.equal(ilikeContainsPattern('100%_done'), '%100\\%\\_done%')
  })
})

describe('additive blog SQL', () => {
  const dir = join(root, 'supabase/migrations')
  const files = readdirSync(dir).filter((name) => name.startsWith('2026100914') && name.endsWith('.sql'))

  it('ships the taxonomy migration for fresh databases', () => {
    assert.ok(files.includes('20261009140200_blog_taxonomy_and_authors.sql'))
  })

  for (const name of files) {
    it(`${name} enables RLS, adds no definer, and does not drop live posts constraints`, () => {
      const sql = readFileSync(join(dir, name), 'utf8')
      assert.equal(/SECURITY DEFINER/i.test(sql), false)
      assert.equal(/DROP CONSTRAINT/i.test(sql), false)
      assert.equal(sql.includes('posts_select_published_curriculum'), false)
      assert.equal(sql.includes("website = 'marketing-agent'"), false)
      const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((match) => match[1])
      for (const table of tables) {
        assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
        assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`))
      }
    })
  }
})

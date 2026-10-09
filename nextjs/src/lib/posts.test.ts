import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  resolvePublication,
  isLivePublication,
  blogSlugsToRefresh,
  assertBlogMedia,
  blogMediaExtension,
  blogMediaObjectPath,
  BLOG_MEDIA_MAX_BYTES,
} from './posts.ts'
import { articleJsonLd, publicSiteOrigin } from './blog-seo.ts'
import { docFromBody, docToMarkdown } from './blog-doc.ts'

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

describe('publication', () => {
  it('rejects a published post with no timestamp before any insert', () => {
    assert.throws(
      () => resolvePublication({ status: 'published', publishedAt: null }),
      /A published post needs a valid published_at timestamp/
    )
    assert.equal(
      httpStatusForPostError('A published post needs a valid published_at timestamp'),
      400
    )
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    assert.equal(isLivePublication('published', tomorrow), false)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    assert.equal(isLivePublication('published', yesterday), true)
    const kept = resolvePublication({
      status: 'draft',
      publishedAt: undefined,
      existingPublishedAt: yesterday,
    })
    assert.equal(kept.status, 'draft')
    assert.equal(kept.published_at, yesterday)
    assert.deepEqual(
      blogSlugsToRefresh(
        { status: 'published', published_at: yesterday, slug: 'old' },
        { status: 'published', published_at: yesterday, slug: 'new' }
      ),
      ['old', 'new']
    )
  })
})

describe('blog media', () => {
  it('rejects a non-image and a file over 5 MB', () => {
    assert.equal(blogMediaExtension('image/svg+xml'), null)
    assert.throws(() => assertBlogMedia('image/svg+xml', 100), /must be jpeg/)
    assert.throws(() => assertBlogMedia('text/plain', 100), /must be jpeg/)
    assert.throws(() => assertBlogMedia('image/png', BLOG_MEDIA_MAX_BYTES + 1), /5 MB/)
    assert.equal(assertBlogMedia('image/png', 100), 'png')
    assert.equal(httpStatusForPostError('Cover image must be jpeg, png, webp, or gif'), 400)
    assert.equal(blogMediaObjectPath('edu', 'user-1', 'abc', 'png').startsWith('edu/user-1/'), true)
  })
})

describe('blog document markdown', () => {
  it('walks headings, paragraphs, and images into markdown', () => {
    assert.equal(
      docToMarkdown({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
          { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'Cover' } },
        ],
      }),
      '## Hi\n\nBody\n\n![Cover](https://example.com/a.png)'
    )
    const fallback = docFromBody('Plain words')
    assert.equal(fallback.content[0]?.content?.[0]?.text, 'Plain words')
    const panel = readFileSync(
      join(root, 'nextjs/src/app/(dashboard)/documents/components/AiPanel.tsx'),
      'utf8'
    )
    assert.match(panel, /const PRESETS/)
    assert.match(panel, /presets = PRESETS/)
    const ai = readFileSync(join(root, 'nextjs/src/app/(dashboard)/documents/api/ai/route.ts'), 'utf8')
    assert.match(ai, /purpose === 'blog'/)
    assert.match(ai, /document content/)
    const documents = readFileSync(
      join(root, 'nextjs/src/app/(dashboard)/documents/components/DocumentEditorClient.tsx'),
      'utf8'
    )
    assert.match(documents, /onExport=\{handleExport\}/)
    assert.equal(documents.includes('presets='), false)
  })
})

describe('public site origin', () => {
  it('omits a host when the env value is empty', () => {
    assert.equal(publicSiteOrigin(undefined), null)
    assert.equal(publicSiteOrigin(''), null)
    assert.equal(publicSiteOrigin('   '), null)
    assert.equal(publicSiteOrigin('not a url'), null)
    assert.equal(publicSiteOrigin('https://example.com/blog'), 'https://example.com')
  })

  it('describes a live post with BlogPosting and BreadcrumbList', () => {
    const blocks = articleJsonLd({
      post: {
        title: 'Hours',
        summary: 'Payment notes',
        slug: 'hours',
        published_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-02T00:00:00.000Z',
        cover_image_url: null,
      },
      authorName: 'Ada',
      origin: 'https://example.com',
    })
    const types = blocks.map((block) => block['@type'])
    assert.deepEqual(types, ['BlogPosting', 'BreadcrumbList'])
    const crumbs = blocks[1].itemListElement as Array<{ name: string }>
    assert.deepEqual(
      crumbs.map((item) => item.name),
      ['Home', 'Blog', 'Hours']
    )
  })

  it('serves RSS only when an origin is configured and lists live posts', () => {
    const rss = readFileSync(join(root, 'nextjs/src/app/(public)/posts/rss.xml/route.ts'), 'utf8')
    assert.match(rss, /status: 503/)
    assert.match(rss, /listPublishedPosts/)
    const robots = readFileSync(join(root, 'nextjs/src/app/robots.ts'), 'utf8')
    assert.match(robots, /\/my-posts/)
    assert.equal(robots.includes("'/posts'"), false)
    assert.equal(robots.includes('"/posts"'), false)
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

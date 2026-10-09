# Sitemap + SEO / Structured Data — Development Plan

> **Repo:** `trumantool/NextJS-Supabase-Starter` · **Supabase:** `cyczlgdaocwueaacqxsh` (starter only)
> **Baseline read:** `main` @ `72e8c3f` (2026-10-08 9:07 PM ET, "Add the starter blog… (#16)"). Rechecked 2026-10-09; `main` is still that commit.
> **Status:** PLAN ONLY. No application code, migrations, or DB changes. Nothing here touches `glplvrljdgowcwuubkau`.
> **Next.js:** `^15.4.8` in `nextjs/package.json`, lockfile resolves **15.5.7**. API notes below target Next 15.

## Changelog

**2026-10-08 — rev 2** (SEO review applied)

- **M1.** `/auth` is removed from robots.txt Disallow. Disallow keeps `/api/` and `/documents/api/`. Auth and dashboard pages rely on `noindex`. Disallow and `noindex` can't both work on one URL. Q9's default also drops the dashboard Disallow.
- **M2.** Previews and custom branch domains: `X-Robots-Tag: noindex` plus allow-all robots.txt, or Vercel Deployment Protection. Production `*.vercel.app` and the www/apex duplicate **308** to `siteUrl()`. `/api/*` is exempt (cron, Stripe webhook, auth callbacks).
- **M3.** One `getBusinessNap()` for `/contact`, the footer, and LocalBusiness JSON-LD. No address → `Organization`. `BusinessType` is a strict union of real subtypes.
- **M4.** Edu markup targets the Course list carousel: `ItemList` on `/courses` with at least 3 courses, each with `@id`, `name`, `description`, and `provider`. Course Info is retired.
- **M5.** `absoluteUrl()` keeps an allow-listed `canonicalParams` (default `['page']`).
- **M6.** lastmod moves only for a significant change (title, slug, summary, body, `body_doc`, cover, video, category/tag set, author, publish status/date). App-side guard now. Optional `content_updated_at` later, starter DB only, on Truman's hold. The live/published filter applies to index-level lastmod too.
- **Verdicts.** `image:loc` only. At most 1000 images per URL. Timezone offsets on every datetime. Tag pages: `noindex`, self-canonical, out of the sitemap, not in robots.txt. WebSite + Organization on the home page. One merged `@graph` per page. No headline length cap.
- **Also in this rev.** Host canonicalization. IndexNow opt-in, default off. Bing Webmaster Tools submission. 308 on slug change via a server-side lookup on the 404 path (redirect table is a later optional step). 404 for empty archives. Trailing-slash assertions. RSS capped at 50 items with `atom:link rel="self"`. `/legal/refund` in `staticRoutes`. A verification step for whether `revalidateTag` purges the Vercel CDN when the route handler sets its own `s-maxage`.
- **Porting.** marketing-agent blog PR [#115](https://github.com/trumantool/marketing-agent/pull/115) is **merged** on that repo's `main` (2026-10-09; it is not still an open draft). Its `app/sitemap.ts` already adds `/blog` through `listSitemapEntries()` and still stamps today's `lastModified` plus `changeFrequency`/`priority`. That port extends the file. AfterAllCare shares `glplvrljdgowcwuubkau` with edu and marketing-agent: additive app code only, and its sitemap uses a server-only admin read.

**For agentic workers:** execute phase by phase. Each phase ends with acceptance criteria; do not start the next phase until they pass. Keep the existing `npm test` (node `--test`) suite green and add new pure-function tests to the `test` script in `nextjs/package.json`.

---

## 1. Goal

Ship a reusable SEO layer in the starter that every app cloned from it (Edu, AfterAllCare, marketing-agent) can adopt by editing **one config file** and **registering content sources**:

1. A real sitemap index (`/sitemap.xml`) plus chunked child sitemaps, driven by a **source registry** (static pages, posts, post archives today; courses/lessons/etc. later), with Google image extension entries (`image:loc` only).
2. `robots.txt` that points at the index and blocks API prefixes only. Pages that must stay out of the index use `noindex` and remain crawlable.
3. Consistent metadata (canonical, Open Graph, Twitter, robots/noindex) from a single site config + `metadataBase`.
4. JSON-LD helpers (Organization or LocalBusiness, WebSite, BreadcrumbList, BlogPosting, ImageObject, plus a Course list example). One `@graph` per page.
5. Tag-based cache invalidation on significant post publish/update/delete, after the CDN purge check in Phase 6.
6. A verification checklist and a port guide.

Non-goals: i18n/hreflang (no i18n exists), video sitemaps (optional later for Edu lessons), news sitemaps, and any DB schema change in this implementation. `content_updated_at` and a slug-redirect table are later, starter-database only, and stay on Truman's hold (§9 Q8). Do not apply either to `glplvrljdgowcwuubkau`.

---

## 2. Current state (ground truth from `main`)

### 2.1 Routes (`nextjs/src/app`)

| Group | Paths | Notes |
|---|---|---|
| **Public** `(public)/` | `/`, `/posts`, `/posts/[slug]`, `/posts/category/[slug]`, `/posts/tag/[slug]`, `/posts/author/[slug]`, `/posts/rss.xml` (route), `/contact`, `/privacy`, `/terms`, `/legal`, `/legal/[document]` (`privacy`, `terms`, `refund`) | All post pages are `dynamic = 'force-dynamic'`. |
| **Auth** `auth/` | `/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/2fa` | Pages are `'use client'`. `auth/layout.tsx` is a server component (can export `metadata`). |
| **Dashboard** `(dashboard)/` (no URL segment) | `/dashboard`, `/admin`, `/admin/blog`, `/my-posts/*`, `/documents/*`, `/chat/*`, `/agents/*`, `/agent-skills`, `/agent-templates`, `/automations/*`, `/storage`, `/todos`, `/user-settings` | `(dashboard)/layout.tsx` is a server component. Middleware also protects `/resume-builder` and `/table`. |
| **API** `api/` + `(dashboard)/documents/api/*` | `/api/*` (posts, stripe, chat, cron, workers, user, admin, auth callback…), `/documents/api/*` | Machine endpoints. Host canonicalization must not 308 these. |

### 2.2 Existing SEO pieces

- **`nextjs/src/app/sitemap.ts`** — exists. Single flat `MetadataRoute.Sitemap`, `force-dynamic`. Emits `/`, `/posts`, every live blog post (`lastModified: post.updated_at`), **all** category and author archive URLs (even with zero live posts). No tag pages, no `/contact` or legal pages, no images, no chunking, no index. No `changeFrequency`/`priority` (good).
- **`nextjs/src/app/robots.ts`** — exists. `allow: '/'`, `disallow: ['/my-posts','/admin','/dashboard','/documents','/auth']`, `sitemap: ${origin}/sitemap.xml` when origin is set. **Missing** from disallow vs. middleware's protected list: `/chat`, `/agents`, `/agent-skills`, `/agent-templates`, `/automations`, `/storage`, `/todos`, `/user-settings`, `/resume-builder`, `/table`, and `/api/`. A test in `nextjs/src/lib/posts.test.ts` (L272–275) asserts robots contains `/my-posts` and does **not** contain `'/posts'` or `"/posts"`. Phase 3 rewrites the `/my-posts` assertion to match the new Disallow list and adds an assertion that `/posts/tag` is absent.
- **`nextjs/src/lib/blog-seo.ts`** — `publicSiteOrigin()` (parses `NEXT_PUBLIC_SITE_ORIGIN`, returns `URL.origin`, so trailing slash/path are already stripped), `postCanonical()`, `xmlEscape()`, `articleJsonLd()` → `[BlogPosting, BreadcrumbList]`. Gaps: no `publisher`, author has no `url`, `image` is a bare string, no `@id` graph, and the page injects it with plain `JSON.stringify` (no `<` escaping → `</script>` injection risk from a post title).
- **`nextjs/src/app/(public)/posts/[slug]/page.tsx`** — good `generateMetadata` (title, description, `alternates.canonical`, `openGraph` type article + `publishedTime`, `twitter`). Missing `modifiedTime`, `authors`, `siteName`.
- **`nextjs/src/app/(public)/posts/[slug]/opengraph-image.tsx`** — generated 1200×630 OG card. In Next, file-based `opengraph-image` **overrides** `openGraph.images` from `generateMetadata`, so the post's `cover_image_url` is never the OG image today (Twitter still uses the cover because there is no `twitter-image` file). **Settled in §9 Q3:** cover first, generated card as fallback, with a matching `twitter-image`.
- **`nextjs/src/app/(public)/posts/rss.xml/route.ts`** — RSS 2.0 feed of every `listPublishedPosts()` row; 503 when origin unset. No `<atom:link>`, no item cap. Not linked via `<link rel="alternate">`.
- Category/tag/author pages: `generateMetadata` with title/description only — no canonical, no OG. `listPostsForCategory` / tag / author return the term with an empty `posts` array when the term exists and has no live posts, and the page then renders **200**. Missing terms already `notFound()`.
- `/posts` (search via `?q=`), `/contact`, `/privacy`, `/terms`: static `metadata` with title/description only. `/`, `/legal`, `/legal/[document]`: **no metadata** (`legal/*` are client components). `/contact` reads `admin_settings` `phone_number` and `contact_address` (`contact/page.tsx`). `PublicFooter` shows product name and links only — no NAP.
- **`nextjs/src/app/layout.tsx`** — `metadata = { title: NEXT_PUBLIC_PRODUCTNAME || 'Starter', description }`. **No `metadataBase`, no title template, no OG/Twitter defaults, no robots.** `<html lang="en">` hard-coded.
- **No** JSON-LD for Organization/WebSite anywhere. **No** `app/icon.*`, `apple-icon`, or logo asset (`nextjs/public/` only has Next demo SVGs + `terms/*.md`).
- **No** noindex anywhere (auth, dashboard, search results, tag pages).
- **No i18n**: no locale segments, no `next-intl`; `legal/[document]` has an unused `lng` prop. → **hreflang is out of scope.**
- **No `trailingSlash`** in Next config, so the Next default applies: `/posts/` 308s to `/posts`.

### 2.3 Env / config

- `nextjs/.env.template`: **`NEXT_PUBLIC_SITE_ORIGIN`** = "Absolute origin for canonical URLs, Open Graph, the sitemap, and RSS" (empty until a host exists); **`POSTS_WEBSITE`** = required site key (`edu | marketing-agent | afterallcare`, no default); `NEXT_PUBLIC_PRODUCTNAME`.
- **`NEXT_PUBLIC_APP_URL` does not exist on `main`.** It is introduced by **open PR #12** (`nextjs/src/lib/auth-redirect.ts`) only as an auth-redirect fallback. This plan uses `NEXT_PUBLIC_SITE_ORIGIN` as the canonical base and accepts `NEXT_PUBLIC_APP_URL` as a fallback (see §9 Q1).
- No `src/config/` directory exists. No `INDEXNOW_KEY`.

### 2.4 Middleware

`nextjs/src/middleware.ts` → `lib/supabase/middleware.ts::updateSession()` runs `supabase.auth.getUser()` on **every** non-static request (matcher excludes only `_next/static|_next/image|favicon.ico|images`). So every crawler hit to `/sitemap.xml`, `/robots.txt`, and `/posts/rss.xml` costs a Supabase Auth call. Protected list redirects anonymous users to `/auth/login`. Do not insert logic between `createServerClient` and `getUser()`.

`protectedPaths` today: `/dashboard`, `/documents`, `/resume-builder`, `/storage`, `/todos`, `/table`, `/user-settings`, `/admin`, `/chat`, `/agents`, `/agent-skills`, `/agent-templates`, `/automations`, `/my-posts`.

Host-specific machine routes that a 308 would break: `/api/cron/automations`, `/api/workers/automations`, `/api/stripe/webhook`, `/api/auth/callback`.

### 2.5 Posts schema (on `main` — prerequisites already satisfied)

`supabase/migrations/20261003120000_posts_stripe_token_ledger.sql` creates `public.posts` with: `id, website (NOT NULL, CHECK in ('edu','marketing-agent','afterallcare')), type (CHECK course|lesson|blog), parent_id, title, slug, summary, body, video_url, cover_image_url, sort_order, status (draft|published), published_at, author_id, origin, created_at, updated_at` + trigger `trg_posts_set_updated_at` (`BEFORE UPDATE`, any column). `20261009140100_posts_body_doc.sql` adds `body_doc jsonb` (TipTap; `lib/blog-doc.ts` already handles `image` nodes). Indexes: `posts_website_type_status_idx`, `posts_blog_public_idx (website, published_at DESC) WHERE type='blog' AND status='published'`.

- **`updated_at` and `website` both exist.** No schema prerequisite for this plan. The trigger bumps `updated_at` on every UPDATE, including `sort_order`, `origin`, and no-op admin saves. That is why lastmod cannot trust `updated_at` alone (§3.4).
- **RLS:** `posts_select_published_blog` lets `anon, authenticated` read only `type='blog' AND status='published' AND published_at <= now()`. Courses/lessons are **not** anon-readable in the starter DB. On the shared project, AfterAllCare blog rows are read with the service role (§2.7).
- Taxonomy (`20261009140200_blog_taxonomy_and_authors.sql`): `blog_categories`, `blog_tags`, `blog_author_profiles` (all with `website`), joins `post_categories`, `post_tags`. `blog_media` table is not anon-readable (bucket `blog-media` is public).
- App-side filter: `lib/posts.ts::requirePostWebsite(process.env.POSTS_WEBSITE)`; `lib/posts-store.ts::listPublishedPosts()` filters `website`, `type='blog'`, `status='published'`, `published_at <= now()`. All public reads use `createSSRClient()` (reads `cookies()` → forces dynamic rendering, blocks caching). `listPublishedPosts()` is unbounded.
- Revalidation today: `posts-store.ts::refreshPublicBlog()` and `(dashboard)/admin/blog/actions.ts` call `revalidatePath('/posts' | '/posts/rss.xml' | '/sitemap.xml' | '/posts/<slug>')`. No `revalidateTag`.

### 2.6 Open PRs that matter (starter)

- **#13** (open, docs) `docs/plans/posts-stripe-token-ledger.md` — its implementation already merged via #14/#15/#16, so it is effectively superseded. This plan does **not** depend on it.
- **#12** (open) login redirect URL — adds `NEXT_PUBLIC_APP_URL` usage and `admin_settings.login_redirect_url`. Don't conflate with the canonical origin.
- **#17** (open) anon RLS / SECURITY DEFINER — splits `post_categories_select`/`post_tags_select` into `_public/_admin/_author`. Public policies still allow anon reads of live blog joins, so the archive sitemap source keeps working after #17.
- #11 (registration provenance) — not relevant.

### 2.7 Sibling apps (read-only peek, 2026-10-09)

- **edu-tutorials** `main`: routes `(public)/courses`, `/courses/[courseSlug]`, `/courses/[courseSlug]/[lessonSlug]`. `lib/courses.ts` `POST_COLUMNS` includes `published_at` and omits `updated_at`. Queries filter `.eq('website', EDU_POST_WEBSITE)` (`'edu'`), `type` course/lesson, `status='published'`. They do **not** gate on `published_at <= now()`. No `sitemap.ts` / `robots.ts`. Edu's own plans state the shared Supabase project is `glplvrljdgowcwuubkau` (also used by marketing-agent). Do not apply starter migrations there.
- **marketing-agent** `main`: blog PR [#115](https://github.com/trumantool/marketing-agent/pull/115) merged 2026-10-09. `nextjs/src/app/sitemap.ts` still emits static paths with `lastModified: new Date()`, `changeFrequency`, and `priority`, and it now also appends `/blog`, `/blog/[slug]`, category, and author URLs from `listSitemapEntries()` in `lib/blog/public-read.ts`. Post URLs use `post.updatedAt`; the index, categories, and authors still use `new Date()`. `app/robots.ts`, hard-coded `PUBLIC_SITE_ORIGIN` in `lib/services/site-origin.ts`, and `lib/services/json-ld.ts` (`jsonLdScript()` escapes `<`, `@graph` Service/FAQ/Breadcrumb) are unchanged by that merge. **The marketing-agent port extends this `sitemap.ts`. It does not delete it.**
- **afterallcare-pt** `main`: `nextjs/src/lib/blog-posts.ts` reads `public.posts` with `createServerAdminClient()` (`PRIVATE_SUPABASE_SERVICE_KEY`), `website = 'afterallcare'`, `type = 'blog'`, `status = 'published'`. The service-role key stays on the server. Those rows live in the shared project `glplvrljdgowcwuubkau` with edu and marketing-agent. The repo README still says not to reuse that project id (starter copy); the live blog read already depends on the shared database. Sitemap work there is additive app code. No schema change. No anon sitemap client.

---

## 3. Architecture

### 3.1 File layout (new unless marked)

```
nextjs/src/config/site.ts                    # per-app config (the ONE file clones edit)
nextjs/src/config/sitemap-sources.ts         # per-app list of registered sources
nextjs/src/lib/seo/url.ts                    # siteUrl(), absoluteUrl(path, query?), host check
nextjs/src/lib/seo/nap.ts                    # getBusinessNap() — contact, footer, JSON-LD
nextjs/src/lib/seo/public-client.ts          # cookie-less anon Supabase client (cacheable)
nextjs/src/lib/seo/sitemap-registry.ts       # types + registry + chunk math
nextjs/src/lib/seo/sitemap-xml.ts            # <urlset>/<sitemapindex> serializers (+ image ns)
nextjs/src/lib/seo/sitemap-cache.ts          # unstable_cache wrappers + tag constants
nextjs/src/lib/seo/sources/static-pages.ts   # source: config.staticRoutes
nextjs/src/lib/seo/sources/posts.ts          # source: live blog posts (+ images)
nextjs/src/lib/seo/sources/post-archives.ts  # source: category/author archives with ≥1 live post
nextjs/src/lib/seo/metadata.ts               # buildMetadata(), noindex constants
nextjs/src/lib/seo/jsonld.ts                 # Organization/LocalBusiness/WebSite/Breadcrumb/BlogPosting/ImageObject
nextjs/src/lib/seo/jsonld-examples.ts        # Course list / lesson builders (exported, unused in starter)
nextjs/src/lib/seo/revalidate.ts             # revalidateSitemap(sourceId), revalidatePostSeo(slugs)
nextjs/src/lib/seo/indexnow.ts               # opt-in ping; default off
nextjs/src/lib/seo/slug-redirect.ts          # lookupSlugRedirect(); 308 on the 404 path
nextjs/src/components/seo/JsonLd.tsx         # one <script type="application/ld+json">, safe escaping
nextjs/src/app/sitemap.xml/route.ts          # sitemap INDEX (replaces app/sitemap.ts in the starter)
nextjs/src/app/sitemaps/[source]/[page]/route.ts  # child sitemaps: /sitemaps/posts/0.xml
nextjs/src/lib/seo/*.test.ts                 # node --test, pure functions only
docs/seo.md                                  # short operator doc (config, verify, submit)
```

Modified: `app/robots.ts`, `app/layout.tsx`, `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `app/auth/layout.tsx`, `app/(dashboard)/layout.tsx`, post/category/tag/author/posts/contact/privacy/terms/legal pages, `components/PublicFooter.tsx`, `lib/blog-seo.ts`, `lib/posts-store.ts`, `app/(dashboard)/admin/blog/actions.ts`, `middleware.ts`, `next.config.ts`, `(public)/posts/rss.xml/route.ts`, `.env.template`, `nextjs/package.json` (test script). **Delete** `app/sitemap.ts` in the starter only (it would conflict with `app/sitemap.xml/route.ts`). marketing-agent keeps its `app/sitemap.ts` and extends it (§ porting).

### 3.2 Built-in `sitemap.ts` vs route handlers — decision

Next 15.5 built-in support: `MetadataRoute.Sitemap` supports `images: string[]` (and `videos`, `alternates.languages`); `generateSitemaps()` splits one sitemap into `/…/sitemap/[id].xml`. **Next 15 does not emit a `<sitemapindex>`** for those children, and a metadata `sitemap.ts` serves one fixed segment — it can't host a registry where sources are added at runtime config. Next 16 changes the `generateSitemaps` `id` argument to a Promise.

**Decision (starter): route handlers for both the index and the children**, with a ~80-line serializer (`sitemap-xml.ts`):

- `GET /sitemap.xml` → real `<sitemapindex>` listing every `(source, page)` with `<lastmod>` = max lastmod in that chunk (live rows only).
- `GET /sitemaps/[source]/[page]` where `page` matches `^\d+\.xml$` → `<urlset>` with `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` and `<image:image><image:loc>` per image. No `image:caption`, `image:title`, `image:geo_location`, or `image:license` (Google deprecated those in 2022). Bing ignores the image extension; that is fine.
- Why route handlers: (1) a true index, (2) one dynamic route serves all registered sources so ports don't add files per type, (3) chunking by URL count **and** byte size, (4) identical output across Next upgrades.
- What we lose: Next's typed `MetadataRoute.Sitemap`. We keep the same shape in our own `SitemapEntry` type so a later move back is mechanical.
- marketing-agent does not take this deletion step. See the porting section.

### 3.3 Registry contract (`sitemap-registry.ts`)

```ts
export type SitemapImage = { loc: string }            // absolute http(s) URL of the original image, not /_next/image
export type SitemapEntry = {
  path: string                                        // site-relative, e.g. "/posts/hello" — no query, no trailing slash
  lastmod?: string | null                             // W3C datetime with timezone, or omit. Never new Date() at request time
  images?: SitemapImage[]                             // ≤ 1000 per URL; image:loc only
}
export type SitemapContext = { site: SiteConfig; db: PublicSupabase; siteKey: string }
export type SitemapSource = {
  id: string                                          // url-safe: 'pages' | 'posts' | 'post-archives' | 'courses' …
  tags: string[]                                      // cache tags, e.g. ['sitemap', 'sitemap:posts']
  pageSize?: number                                   // default 10_000, hard cap 50_000
  count(ctx: SitemapContext): Promise<number>
  list(ctx: SitemapContext, range: { offset: number; limit: number }): Promise<SitemapEntry[]>
  lastmod?(ctx: SitemapContext): Promise<string | null> // max lastmod of LIVE rows in this source, for the index
}
export function defineSitemapSource(s: SitemapSource): SitemapSource
export function chunkCount(total: number, pageSize: number): number // ≥1 only if total>0
```

`config/sitemap-sources.ts` (app-owned):

```ts
import { staticPagesSource } from '@/lib/seo/sources/static-pages'
import { postsSource } from '@/lib/seo/sources/posts'
import { postArchivesSource } from '@/lib/seo/sources/post-archives'
export const sitemapSources = [staticPagesSource, postsSource, postArchivesSource] // Edu appends coursesSource, lessonsSource
```

Rules enforced in core (not in each source):

- Absolute URL = `siteUrl + path`. Leading `/`. No trailing slash except the origin root in JSON-LD `url` (`https://host/`).
- Drop a path when it equals a `noindexPaths` entry or starts with that entry plus `/` (segment boundary). `/api` must not drop `/apis-explained`.
- Tag URLs are excluded by the archive source, not by a `/posts` prefix.
- De-dupe by `loc`. XML-escape. Never emit `changefreq` or `priority`.
- lastmod is ISO-8601 / W3C with a timezone (`toISOString()` → `Z` is valid). Omit when unknown. Reject any value later than `now`.
- Paginated URLs (`?page=N` for N>1) stay out of the sitemap. Page 1 only.
- Images must be ones the page actually renders, absolute and crawlable, de-duped, at most **1000** per `<url>`. List the storage URL, not `/_next/image?...`.
- If a chunk serializes over 45 MB, log an error. The source's `pageSize` must be lowered (unit test guards the serializer math). File limits remain 50,000 URLs or 50 MB uncompressed. Image tags add bytes, not URLs.
- Unknown source or out-of-range page → 404.

### 3.4 Data access, filters, caching

- **Anon, cookie-less client** (`public-client.ts`): `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })`. RLS already limits anon to live blog rows; queries still filter explicitly (defense in depth + shared DBs): `.eq('website', site.siteKey).eq('type','blog').eq('status','published').lte('published_at', now)`. Never use the service-role client for the starter sitemap. AfterAllCare is the exception: its rows are not anon-readable, so that port uses the server admin client (§ porting, §9 Q7).
- **siteKey**: `site.siteKey` reads `POSTS_WEBSITE` via existing `requirePostWebsite()`. If unset → posts sources return 0 (index still lists `pages`) and log once; don't throw a 500 to crawlers.
- **Significant lastmod (M6).** `trg_posts_set_updated_at` fires on any UPDATE. Google and Bing only trust lastmod when it marks a significant update. The app skips the `posts` UPDATE when none of these changed: **title, slug, summary, body, body_doc, cover_image_url, video_url, category set, tag set, author_id, status, published_at**. A taxonomy-only change still writes the post row so the trigger can move `updated_at` (the join tables are not the lastmod source). A no-op admin save does not write. Document that, until Q8, `updated_at` means "a significant field changed" because the app refused the other writes.
- **lastmod value:** `max(updated_at, published_at)` among rows with `status='published'` and `published_at <= now()`. A scheduled post goes live at `published_at` without a later content edit, so `updated_at` alone can predate publication. Fallback `published_at`. Omit if both null. Format with a timezone offset. The same live filter applies to `SitemapSource.lastmod()` used on the **index**. A future-dated post must not push a child sitemap's `<lastmod>` into the future. Unit test: no emitted lastmod is later than `now`.
- **Optional later column (Q8, not this implementation):** `content_updated_at`, bumped only for the significant set above, starter database only, on Truman's hold. Do not add the migration in the implementation PR.
- **Archives:** include a category or author URL only when it has at least one live post. lastmod = newest live post lastmod in that archive. **Tag pages are excluded.** Empty category/author/tag archives return **404** (`notFound()`), including when the term row exists and the live post list is empty. A 200 with noindex on an empty archive is a soft-404. `/posts?q=` with no results stays a 200 with `noindex` (it is a search URL, not an archive).
- **Static pages:** from `site.staticRoutes` (default `/`, `/posts`, `/contact`, `/privacy`, `/terms`, `/legal/refund`). lastmod omitted unless the route declares one. `/posts` lastmod = newest live post lastmod. `/` omits lastmod: the home page does not list posts (`(public)/page.tsx` is a feature/pricing page).
- **Images:** posts → `cover_image_url` + TipTap `image` nodes in `body_doc` (reuse `lib/blog-doc.ts`) + markdown `![](url)` in `body` when `body_doc` is null. Only absolute http(s) URLs, de-duped, ≤1000, `image:loc` only. Images ride inside the content sitemap. Off-domain Supabase Storage URLs are allowed; `docs/seo.md` says to verify that storage host in Search Console. `alt` on the `<img>` is a page concern, not a sitemap field.
- **Caching:** each `count`/`list`/`lastmod` call is wrapped in `unstable_cache(fn, [sourceId, page], { tags: source.tags, revalidate: 3600 })`. Route handlers set `export const revalidate = 3600`. A custom `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` is **provisional** until the Phase 6 CDN check passes. If `revalidateTag` does not purge that CDN entry, drop the custom header and rely on Next revalidation. The TTL also covers scheduled posts going live (no write event fires then). (`unstable_cache` is the Next 15 API; on a Next 16 upgrade switch to `'use cache'` + `cacheTag`.)
- **Tags:** `sitemap` (everything), `sitemap:<sourceId>`, plus content tags `posts` and `post:<slug>` for pages that later adopt cached reads.
- **Scheduled posts:** up to 1 hour stale is acceptable. Optional later improvement: a Vercel Cron every 5–15 minutes that calls `revalidateTag('sitemap:posts')` when a post crossed `published_at`. Not required for acceptance.

### 3.5 Canonical base URL and host (`lib/seo/url.ts` + `config/site.ts`)

`siteUrl()` = first valid of `NEXT_PUBLIC_SITE_ORIGIN`, `NEXT_PUBLIC_APP_URL` (PR #12), `https://${VERCEL_PROJECT_PRODUCTION_URL}`; normalized through existing `publicSiteOrigin()` → origin only, no trailing slash, lowercase host. In production (`VERCEL_ENV === 'production'` or `NODE_ENV === 'production'` without Vercel) it must be `https:`; otherwise warn.

`absoluteUrl(path, query?)` ensures a leading `/`, strips a trailing `/` except the path `/`, drops the fragment, and **keeps only allow-listed query keys**. Default allow-list is `canonicalParams: ['page']` (M5). `/posts?page=2` canonicalizes to `/posts?page=2`. `/posts?page=2&utm_source=x` canonicalizes to `/posts?page=2`. `/posts?q=hello` drops `q`. Tracking, sort, and filter params are stripped. Hash is stripped.

`canonicalHost()` = `new URL(siteUrl()).host` when `siteUrl()` is non-null.

Every canonical, OG URL, sitemap `<loc>`, robots `Sitemap:` line, RSS link, and JSON-LD `@id` uses `siteUrl()` / `absoluteUrl()`. Nothing else reads the origin env directly.

**Host canonicalization (M2), in middleware, after `getUser()`:**

| Request | Response |
|---|---|
| `VERCEL_ENV === 'production'` and `Host` ≠ `canonicalHost()`, and the path is not under `/api/` | **308** to the same path and allow-listed query on `siteUrl()`. Covers the production `*.vercel.app` alias and the www/apex duplicate. |
| Path is `/api/*` or `/documents/api/*` | **No host redirect.** Cron (`/api/cron/automations`, `/api/workers/automations`), Stripe (`/api/stripe/webhook`), and auth (`/api/auth/callback`) must keep the host they were called on. |
| `siteUrl()` is null | No redirect. |
| Preview, or a custom domain on a non-production branch (`staging.example.com`) | No redirect. `X-Robots-Tag: noindex, nofollow` on the response, and robots.txt allows all (§3.6). Vercel already noindexes Preview deployments and outdated Production deployments. It does **not** noindex a custom domain assigned to a non-production branch, so this header is required there. |

`app/robots.ts` does not receive the request. Production robots are only served on the canonical host because the other production hosts 308 first. Non-production deployments serve allow-all robots from `robots.ts` because `site.indexable` is false for the whole deployment.

### 3.6 Indexability (two lists, never both on one URL)

robots.txt `Disallow` and `noindex` do not combine. Google will not see a `noindex` on a URL that robots.txt blocks, so the URL can remain as a URL-only result. Disallow only where a URL-only listing is acceptable and the goal is crawl-budget savings. Auth and dashboard **pages** rely on `noindex` (and, for the dashboard, on the anonymous redirect to `/auth/login`).

| Surface | noindex (meta or header) | robots.txt Disallow |
|---|---|---|
| `/auth/*` | `auth/layout.tsx`: `robots: { index:false, follow:false }`. Crawlable, so Google can drop the URLs. | **No.** |
| Dashboard prefixes in `protectedPaths` | `(dashboard)/layout.tsx`: `robots: { index:false, follow:false }`. Anonymous users are redirected to `/auth/login` (also noindex). | **No**, under Q9's default. The layout tag is what a logged-in 200 would send. |
| `/api/*`, `/documents/api/*` | Optional `X-Robots-Tag: noindex`. Google will not see it while the URL is disallowed. The header is redundant. Say that in `docs/seo.md`. Keep it only as a harmless extra. | **Yes.** `Disallow: /api/` and `Disallow: /api$`. Same pair for `/documents/api/`. Segment form, so `/apis-explained` stays allowed. |
| `/posts?q=…` | `noindex, follow`. No canonical pointing at `/posts` (mixed signal). | No. |
| `/posts/tag/[slug]` with ≥1 live post | `noindex, follow` and a **self-canonical** (`absoluteUrl` of that tag path). Not a canonical to another URL. | **No.** `posts.test.ts` must assert robots does not contain `/posts/tag`. |
| `/posts/tag/[slug]` when `indexTagArchives` is true | Index only with unique intro copy and ≥3 live posts. Fewer posts stay noindex and out of the sitemap. | No. |
| Empty category, author, or tag archive | **404** via `notFound()`. | No. |
| Drafts / future posts | 404 via `getPublishedPostBySlug`. On that 404 path, call `lookupSlugRedirect` and 308 when it hits (§3.10). | No. |
| Duplicate legal pages | One canonical set (§9 Q2). The other set 308s to it. `/legal/refund` is the only refund URL and is indexable. | No. |
| Non-production deploy, including a custom branch domain | `X-Robots-Tag: noindex, nofollow` on every response. Preferred extra: Vercel Deployment Protection so preview crawlers get 401. | **Allow all** (no `Disallow: /`). |
| Production host ≠ `canonicalHost()` | 308 to `siteUrl()` (§3.5). If `siteUrl()` is null, `X-Robots-Tag: noindex` instead of a redirect. | Production rules only on the canonical host. |

`site.indexable` is true only when `VERCEL_ENV === 'production'` (or non-Vercel production) **and** `siteUrl()` is set. Host mismatch is handled by the redirect, not by flipping the whole deployment to non-indexable (the canonical host shares that deployment).

`noindexPaths` (meta/header, and the sitemap segment filter) is a superset of middleware `protectedPaths`, plus `/auth`. `robotsDisallow` is only `/api` and `/documents/api`. Export `PROTECTED_PATHS` from `lib/supabase/middleware.ts` for the superset test. A second test asserts `/auth` is absent from `robotsDisallow` and present in `noindexPaths`.

### 3.7 Metadata (`lib/seo/metadata.ts`)

- Root `app/layout.tsx`: `metadataBase: new URL(siteUrl())`, `title: { default: site.name, template: '%s | ' + site.name }`, `description: site.description`, `applicationName`, `openGraph: { siteName, locale: site.locale, type:'website', images:[site.defaultOgImage] }`, `twitter: { card:'summary_large_image', site: site.twitterHandle }`, `alternates.types['application/rss+xml'] = '/posts/rss.xml'`, `icons` from config. `<html lang={site.language}>`.
- Home uses `title.absolute` (brand plus value proposition) so the template does not render "Brand | Brand".
- `buildMetadata({ title, description, path, query?, canonicalParams?, images?, type?, noindex?, publishedTime?, modifiedTime?, authors? })` returns `Metadata` with `alternates.canonical = absoluteUrl(path, query)` using the allow-list (default `['page']`). OG and Twitter mirror that URL. `og:image:alt` when an image is set. Robots when `noindex`. Search URLs pass `noindex` and omit the canonical (or self-canonical of the search URL — they must not point at `/posts`).
- Pagination, when a fork adds it: each `?page=n` is its own canonical, with crawlable `<a href>` next/prev links. Do not rely on `rel=next`/`rel=prev`. Leave `?page=n` for n>1 out of the sitemap. `listPublishedPosts()` is unbounded today; paginate before a large archive becomes a TTFB/LCP problem. That pagination is a follow-up, and the URL helper must already be safe for it.
- Apply to: `/` (home), `/posts`, post detail (`modifiedTime`, `authors`, `siteName`, `article:modified_time`), category/author (title `Category: {name} | {brand}`, description from the term), tag (noindex + self-canonical), `/contact`, legal pages (server wrapper around the client renderer for `legal/[document]`).
- **OG image (Q3, settled):** when `cover_image_url` is set, it is the OG and Twitter image. The generated 1200×630 card is the fallback when there is no cover. File-based `opengraph-image` must not override a cover. Add a matching `twitter-image` so the X card and OG agree. Absolute URLs via `metadataBase`. Alt text set.
- hreflang: **not applicable**. `buildMetadata` accepts an optional `languages` map for forks that add i18n later (self + reciprocal + `x-default`, and the same variants in the sitemap via `xhtml:link`).

### 3.8 Structured data (`lib/seo/jsonld.ts`)

All builders return plain objects. Each page renders **one** `<JsonLd data={{ '@context':'https://schema.org', '@graph':[…] }} />`. Do not also emit JSON-LD from the layout, or the home page will contain two WebSite nodes. `JsonLd.tsx` uses `JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')` (same `<` escape as marketing-agent `jsonLdScript`, plus the two line separators). A server-rendered `<script type="application/ld+json">`. Do not use `next/script`.

Google does not fetch another page to resolve an `@id`. When a page references the organization or website, inline `name` and `url` next to `@id`. Stable ids: `${site}/#organization`, `${site}/#website`, `${url}#article`, `${url}#breadcrumb`, `${url}#course`.

| Builder | Where rendered | Key fields |
|---|---|---|
| `organizationJsonLd(nap, site)` | **Home page** graph, and `/contact` when that page shows the same NAP | `@type` from `getBusinessNap()` (§3.9). `name`, `url`, `logo` (ImageObject, asset ≥112×112, crawlable, readable on white; config default 512×512), `sameAs`, `contactPoint`. LocalBusiness also needs a visible `address`. Add `telephone` (country code), `geo` (only when lat/lng have ≥5 decimal places), `openingHoursSpecification` (`opens`/`closes`), `priceRange`, `areaServed` only when the resolver has them. `url` is the page that shows the NAP. |
| `websiteJsonLd(site)` | **Home page** graph only. Exactly one WebSite node. | `name` matches `og:site_name` and the home title brand, `url` = `https://host/` (trailing slash), `publisher` inline `{@id, name, url}`, optional `alternateName`, `inLanguage`. **No `SearchAction`.** |
| `breadcrumbJsonLd(items)` | post, archives, legal, (Edu) course/lesson — inside that page's single graph | absolute `item` URLs that match a visible breadcrumb trail. Last item may omit `item`. |
| `blogPostingJsonLd(post, authors, site)` | `/posts/[slug]`, inside that page's graph | `headline` equals the visible H1. **Do not truncate** (no 110-character cap). `description`, `image` as an array of ImageObject or URLs (16:9, 4:3, and 1:1 when those variants exist), `datePublished`, `dateModified` (same lastmod rule, with timezone), one `author` object per visible author (`Person`, `name`, `url: /posts/author/<slug>`), `publisher` inline `{@id, @type, name, url}`, `mainEntityOfPage`, `url`, `isPartOf`. |
| `imageObjectJsonLd(url, {width,height,caption})` | used inside the above | `contentUrl`/`url`. `width`/`height` only when known (OG card 1200×630). |

**NAP (M3).** `getBusinessNap()` is the only source for the phone, address, and business type shown on `/contact`, in `PublicFooter`, and in JSON-LD. The three must render the same strings. LocalBusiness requires `name` and `address`. If the resolver has no address, the builder emits `Organization` even when config asked for a LocalBusiness subtype. Do not emit an invalid LocalBusiness. The footer (present on the home page) is enough visible NAP for the home-page node; `/contact` shows the same block.

**Edu extension examples** (`jsonld-examples.ts`, documented, not rendered in the starter). Google retired **Course Info** (the `offers` / `hasCourseInstance` rich result) in June 2025 and removed it from the Rich Results Test in September 2025. The remaining feature is the **Course list** carousel. `offers`, `hasCourseInstance`, and `courseWorkload` stay in the example only when they are accurate and visible. They are not a rich-result goal.

```ts
// Summary page: /courses — emit only when courses.length >= 3
courseListJsonLd({
  url: absoluteUrl('/courses'),
  courses: courses.map((c) => ({
    '@type': 'Course',
    '@id': `${c.url}#course`,
    name: c.name,
    description: c.description,          // must match visible text; Google displays ~60 chars
    url: c.url,
    provider: { '@type': 'Organization', name: site.name, url: siteUrl(), sameAs: site.social },
  })),
})
// ItemList of ListItem { position, url, item: the Course }. All-in-one page is the alternative.
// Only real courses with an explicit educational outcome and instructor(s). A single short video does not qualify.

// Course page still sets the id the lesson points at
courseJsonLd({
  '@id': `${url}#course`,
  url, name, description,
  provider: { '@type': 'Organization', '@id': `${site}/#organization`, name: site.name, url: siteUrl() },
})

// Lesson page
lessonJsonLd({
  '@type': ['LearningResource', 'Article'],
  '@id': `${url}#lesson`,
  name, url,
  isPartOf: { '@type': 'Course', '@id': `${courseUrl}#course`, name: courseTitle },
  position: sort_order,
  learningResourceType: 'Lesson',
  // If the lesson is gated: isAccessibleForFree: false and hasPart.cssSelector for the paywalled section.
  // VideoObject only when thumbnailUrl and uploadDate are real.
})
```

Breadcrumb for lessons: Home › Courses › {course} › {lesson}. Rich Results Test for Edu shows **Course list** on `/courses` when at least 3 courses are marked up. It will not show Course info.

### 3.9 Per-app config (`src/config/site.ts`)

`BusinessType` is a closed union of real schema.org types. A template literal such as `` `${string}Business` `` is not allowed (`FooBusiness` must not type-check). Ports add a real schema.org type to the union when they need one.

```ts
export type BusinessType =
  | 'Organization'
  | 'EducationalOrganization'
  | 'LocalBusiness'
  | 'MedicalBusiness'
  | 'PhysicalTherapy'          // schema.org MedicalBusiness subtype; AfterAllCare
  | 'Physician'
  | 'Dentist'
  | 'HomeAndConstructionBusiness'
  | 'ProfessionalService'
  | 'HealthAndBeautyBusiness'
  | 'Store'
  | 'Restaurant'
  | 'LegalService'
  | 'FinancialService'
  | 'AutomotiveBusiness'
  | 'SportsActivityLocation'
  | 'LodgingBusiness'
  | 'EmergencyService'
  | 'ChildCare'
  | 'Library'

export const site = {
  name: process.env.NEXT_PUBLIC_PRODUCTNAME || 'Starter',
  description: 'Next.js and Supabase starter…',
  url: siteUrl(),
  siteKey: process.env.POSTS_WEBSITE,
  language: 'en', locale: 'en_US',
  indexable: process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : true,
  logo: { url: '/logo.png', width: 512, height: 512 },           // ≥112px; must exist in /public
  defaultOgImage: { url: '/og-default.png', width: 1200, height: 630, alt: '' },
  twitterHandle: undefined as string | undefined,
  social: [] as string[],
  business: {
    type: 'Organization' as BusinessType,
    legalName: undefined, email: undefined, telephone: undefined,
    address: undefined as undefined | { street: string; locality: string; region: string; postalCode: string; country: string },
    geo: undefined as undefined | { lat: number; lng: number },
    openingHours: undefined as undefined | { opens: string; closes: string; dayOfWeek: string }[],
    priceRange: undefined, areaServed: undefined,
  },
  // Q2 still open for /privacy vs /legal/privacy. /legal/refund is settled and listed.
  staticRoutes: ['/', '/posts', '/contact', '/privacy', '/terms', '/legal/refund'],
  noindexPaths: ['/auth', '/dashboard', '/admin', '/my-posts', '/documents', '/chat', '/agents',
    '/agent-skills', '/agent-templates', '/automations', '/storage', '/todos', '/user-settings',
    '/resume-builder', '/table'],
  robotsDisallow: ['/api', '/documents/api'],   // trailing-slash + $ forms emitted in robots.ts
  indexTagArchives: false,
  canonicalParams: ['page'] as const,
  indexNow: { enabled: false },                 // Q10. Requires INDEXNOW_KEY when a clone turns it on.
} as const
```

`getBusinessNap()` reads `admin_settings` (`phone_number`, `contact_address`, `support_email`, `support_hours`) and fills structured PostalAddress / geo / hours from `site.business` only when those structured fields describe the **same** visible address and phone. Config does not override a different admin value. Missing address forces `@type: 'Organization'`. A unit test fails if `business.type` is a LocalBusiness subtype and the resolver has no address while the builder still emits that subtype.

### 3.10 Slug changes, RSS, IndexNow

**Slug 308.** Renaming a post or author slug currently 404s the old URL. On the server, the post and author pages call `lookupSlugRedirect(pathname)` when the live row is missing, **before** `notFound()`. A hit responds with **308** (`permanentRedirect`) to the current path and calls `revalidatePostSeo([oldSlug, newSlug])`. A miss falls through to 404. Unpublished or deleted content stays 404 (`notFound()`). A 410 is optional and not required.

The lookup is in the route. The backing **redirect table is a later optional step** (§9 Q8): starter database only, not part of this implementation, never applied to `glplvrljdgowcwuubkau`. Until that table exists, `lookupSlugRedirect` returns null (the 404 stands) and the call site is already on the 404 path. Do not store old slugs in `origin` or another unrelated column.

**RSS** (`posts/rss.xml/route.ts`):

- Cap at the **50** newest live posts (`listPublishedPosts` is unbounded).
- `<atom:link href="{absoluteUrl('/posts/rss.xml')}" rel="self" type="application/rss+xml"/>` with the Atom namespace.
- `<lastBuildDate>` = newest included lastmod (RFC-822), not `new Date()` at request time.
- Item `<link>` and `<guid>` via `absoluteUrl`.
- Root layout already advertises the feed. Optional later: submit the feed in GSC/BWT (both accept RSS 2.0). WebSub is optional and out of scope.

**IndexNow (Q10, default off).** `site.indexNow.enabled === false` unless a clone opts in. When enabled, `revalidatePostSeo` POSTs changed, deleted, and redirected URLs to `https://api.indexnow.org/indexnow` only if all of these hold: `INDEXNOW_KEY` matches `^[A-Za-z0-9-]{8,128}$`, the key file is publicly reachable at `/{key}.txt`, the deployment is production, and the host is `canonicalHost()`. At most 10,000 URLs per call. Debounce at least 5 minutes per URL. Log status codes (200/202 ok; 422/429 back off). Google does not participate. Bing, Yandex, Seznam, Naver, Yep, and Amazon do. A clone with the flag left at the default must not ping.

### 3.11 robots.txt output

`app/robots.ts` (production, canonical host):

- `allow: '/'`
- `disallow`: `/api/`, `/api$`, `/documents/api/`, `/documents/api$`
- `sitemap: absoluteUrl('/sitemap.xml')` (one absolute line)
- `host` omitted (Google ignores it)

Non-indexable deployment: `allow: '/'` and no disallow rules. The noindex header does the work. `posts.test.ts` L272–275 is updated: `/my-posts` is **absent** (Q9 default), `'/posts'` and `"/posts"` stay absent, `/posts/tag` is absent, `/api/` is present, `/auth` is absent.

---

## 4. Phased tasks

### Phase 0 — Decisions & prerequisites (no code)

- §9 Q3 and Q4 are settled. Q2's refund URL is settled. Proceed with the defaults on Q1, Q5, Q6, Q7, Q9, and Q10. Q8 stays unanswered: do not add `content_updated_at` or `slug_redirects`.
- Confirm no schema change is in this implementation (`updated_at`, `website`, `body_doc` exist on starter `main`).
- Add logo + default OG image assets (designer/Truman) or ship placeholders flagged in `docs/seo.md`. Logo ≥112×112.
- **Accept:** decisions recorded at the top of the implementation PR description. This planning PR does not implement them.

### Phase 1 — Config + URL helpers

- Create `src/config/site.ts`, `src/lib/seo/url.ts`, `src/lib/seo/nap.ts`. Export `PROTECTED_PATHS` from `lib/supabase/middleware.ts` (no behavior change).
- Tests `src/lib/seo/url.test.ts`: trailing slash stripped except `/`, path normalization, `canonicalParams` default `['page']` kept and `utm_*` / `q` dropped, http→https warning, empty env → null, `NEXT_PUBLIC_APP_URL` fallback, `noindexPaths` ⊇ `PROTECTED_PATHS`, `/auth` ∈ `noindexPaths`, `/auth` ∉ `robotsDisallow`, segment-boundary match, NAP fallback to `Organization` when address is missing, `BusinessType` rejects a non-member.
- `.env.template`: document precedence (`NEXT_PUBLIC_SITE_ORIGIN` > `NEXT_PUBLIC_APP_URL` > Vercel production URL) and `INDEXNOW_KEY` (unused while IndexNow is off).
- **Accept:** `npm test` green including the new file; no runtime behavior change yet.

### Phase 2 — Sitemap core (index + children + registry)

- Create `sitemap-registry.ts`, `sitemap-xml.ts`, `public-client.ts`, `sitemap-cache.ts`, `sources/{static-pages,posts,post-archives}.ts`, `config/sitemap-sources.ts`.
- Create `app/sitemap.xml/route.ts` and `app/sitemaps/[source]/[page]/route.ts`; **delete** starter `app/sitemap.ts`.
- `Content-Type: application/xml; charset=utf-8`. 404 for unknown source/page. When `siteUrl()` is null return 503 text (mirror RSS behavior). Provisional `Cache-Control` only until Phase 6 says to keep it.
- `middleware.ts` matcher: also exclude `sitemap.xml`, `sitemaps/`, `robots.txt`, `posts/rss.xml`.
- Tests: escaping (`&`, `<`, quotes), image namespace and `image:loc` only when images exist, no caption/title, no `changefreq`/`priority`, chunk math (0, 1, 50 000, 50 001), 1000-image cap, lastmod `max(updated_at, published_at)` with timezone, no future lastmod, live filter on index `lastmod()`, significant-change skip does not advance lastmod, noindex segment filter, de-dupe, `?page=2` absent.
- **Accept:** `/sitemap.xml` returns `<sitemapindex>` listing `/sitemaps/pages/0.xml`, `/sitemaps/posts/0.xml`, `/sitemaps/post-archives/0.xml` (sources with 0 URLs omitted). Children validate (§6). A draft, future-dated, or other-`website` post never appears. Tag URLs absent. `/legal/refund` present. Empty archives absent.

### Phase 3 — robots.txt and host canonicalization

- Rewrite `app/robots.ts` per §3.11. Middleware 308 for non-canonical production hosts, exempting `/api/*` and `/documents/api/*`. Non-production: allow-all robots plus `X-Robots-Tag: noindex, nofollow` (`next.config.ts` `headers()` or middleware).
- Update `posts.test.ts` assertions (§3.11).
- **Accept:** `curl /robots.txt` on the canonical host shows `/api/` and `/documents/api/`, does not show `/auth` or `/posts/tag` or `/my-posts`, and has one absolute `Sitemap:` line. `curl -sI https://<project>.vercel.app/` is 308 to `siteUrl()`. `curl -sI https://<project>.vercel.app/api/stripe/webhook` is not a 308 to the canonical host. A preview robots.txt allows `/` and the response carries `x-robots-tag: noindex`.

### Phase 4 — Metadata + noindex

- `lib/seo/metadata.ts` (`buildMetadata`, `NOINDEX`, `NOINDEX_FOLLOW`).
- Root layout `metadataBase` + defaults (§3.7). `auth/layout.tsx` and `(dashboard)/layout.tsx` noindex. Home `title.absolute`.
- Per-page metadata: home, `/posts` (search is noindex and does not canonical to `/posts`), post detail, category/author, tag (noindex + self-canonical), contact, legal server wrapper.
- OG: cover when `cover_image_url` is set, generated card otherwise, plus matching `twitter-image` and `og:image:alt`.
- Empty category/author/tag archives call `notFound()`.
- Wire `lookupSlugRedirect` on the post and author 404 paths (returns null until Q8).
- **Accept:** each indexable public page has exactly one absolute https canonical; `og:url` matches it. `/auth/login` is 200 with `<meta name="robots" content="noindex…">` and is not disallowed. `/posts?q=x` and `/posts/tag/x` are noindex. `/posts/tag/x` canonical is that tag URL. A category with zero live posts is 404. `curl -sI $BASE/posts/` is 308 to `/posts`.

### Phase 5 — JSON-LD

- `lib/seo/jsonld.ts`, `jsonld-examples.ts`, `components/seo/JsonLd.tsx`, `getBusinessNap()` used by `/contact`, `PublicFooter`, and the home/contact graph.
- Replace `articleJsonLd` usage. Keep `posts.test.ts` asserting `BlogPosting` then `BreadcrumbList` inside the single `@graph` (update the test to read `@graph`, not two top-level documents).
- Home page graph: Organization or LocalBusiness + WebSite. Other pages do not repeat those nodes; publisher/provider inline `@id` + `name` + `url`.
- Tests: `</script>` and U+2028 in a title are escaped; LocalBusiness omitted (Organization emitted) when address is absent; headline is the full title; course list example has `ItemList`, `@id`, `name`, `description`, `provider` on each course, and is specified for ≥3 courses; one script per page.
- **Accept:** Rich Results Test on a post → Article + Breadcrumbs, 0 errors. Schema Markup Validator on the home page → Organization (or LocalBusiness) and WebSite, 0 errors, one WebSite node. Edu later: Rich Results Test on `/courses` shows Course list only when ≥3 courses are marked up.

### Phase 6 — Revalidation, RSS, IndexNow hook

- `lib/seo/revalidate.ts`: `revalidateSitemap(...sourceIds)` → `revalidateTag('sitemap:<id>')` and `'sitemap'`. `revalidatePostSeo(slugs)` → posts, post-archives, and pages tags, plus existing `revalidatePath` calls. Call it from publish/unpublish/delete, taxonomy writes, and author-profile slug changes. Skip the underlying post UPDATE when the significant-change set is unchanged, so lastmod does not move.
- **CDN check (required before promising "next request"):** on a Vercel preview, with the route handler setting `Cache-Control: s-maxage=3600`, fetch `/sitemaps/posts/0.xml`, call `revalidateTag('sitemap:posts')`, fetch again. If the CDN still serves the previous body, **drop that Cache-Control header** and rely on `export const revalidate` / tag revalidation, which Vercel purges. Record the result in the implementation PR. Do not claim instant purge until this passes.
- RSS: cap 50, `atom:link rel="self"`, `lastBuildDate`, `absoluteUrl` links.
- `indexnow.ts` is called from `revalidatePostSeo` and returns immediately when `enabled` is false.
- **Accept:** with the cache strategy the CDN check selected, publishing a post puts it in `/sitemaps/posts/0.xml` on the next request; unpublish/delete removes it; a significant edit advances lastmod; a no-op save does not. RSS has at most 50 items and a self atom link. IndexNow makes no network call in the starter.

### Phase 7 — Verification + docs

- Run §6 against a preview (Deployment Protection or the noindex header) and production.
- Write `docs/seo.md`: config fields, adding a source, verify commands, the CDN-purge result, GSC **Domain** property, submit only the index, Bing Webmaster Tools submission (or import from GSC), "Excluded by noindex" vs "Blocked by robots.txt" (the blocked set should be `/api/` and `/documents/api/` only), verify the Supabase storage host if images stay off-domain, IndexNow stays off unless `INDEXNOW_KEY` is set. Link the doc from `README.md`.
- **Accept:** §6 checks pass; doc merged with the implementation (not with this planning PR).

---

## 5. Risks

- **Caching vs. cookies:** `createSSRClient()` inside a source makes the route dynamic and defeats caching. Sources import `public-client.ts` only. AfterAllCare's source is the documented exception and imports the server admin client.
- **Shared DB leakage:** a ported source without `.eq('website', siteKey)` lists another site's posts. Core passes `siteKey` in `ctx`.
- **CDN `s-maxage` vs `revalidateTag`:** unproven. Phase 6 tests it and drops the header on failure. Do not ship the "next request" claim before that.
- **Scheduled posts** go live with no write → up to 1 h stale sitemap.
- **Deleting starter `app/sitemap.ts`** while a route handler exists at the same path is required there. marketing-agent must not delete its sitemap file.
- **Host 308** must run after `getUser()` and must exempt `/api/*` and `/documents/api/*`.
- **Disallow + noindex** on auth or dashboard URLs hides the noindex. The tests lock the split.
- **OG file convention** silently overrides cover images if `opengraph-image.tsx` stays unconditional.
- **Duplicate legal URLs** (`/privacy` vs `/legal/privacy`) stay open in Q2. `/legal/refund` does not.
- **Slug 308s do nothing** until Q8's table exists. The call site must still be there.
- **Next 16:** `unstable_cache` → `'use cache'`. Route handlers stay.

---

## 6. Verification checklist

```bash
BASE=https://<canonical-prod-host>
curl -sSI $BASE/sitemap.xml | grep -i -E 'HTTP/|content-type|cache-control'   # 200, application/xml
curl -sS  $BASE/robots.txt                                                     # Sitemap: $BASE/sitemap.xml
# Disallow has /api/ and /documents/api/. It has neither /auth nor /posts/tag nor /my-posts.
curl -sS  $BASE/sitemap.xml -o index.xml && xmllint --noout --schema https://www.sitemaps.org/schemas/sitemap/0.9/siteindex.xsd index.xml
for u in $(xmllint --xpath '//*[local-name()="loc"]/text()' index.xml); do
  curl -sS "$u" -o child.xml
  xmllint --noout child.xml
  xmllint --noout --schema sitemap-with-image.xsd child.xml
  echo "$u urls=$(grep -c '<url>' child.xml) bytes=$(wc -c < child.xml)"  # ≤50000 and <52428800
done
grep -E 'changefreq|priority|<image:caption>|<image:title>' child.xml && echo FAIL || echo ok
# every <lastmod> matches a timezone offset (Z or ±hh:mm) and is <= now
curl -sS $BASE/posts/<draft-slug> -o /dev/null -w '%{http_code}\n'             # 404
curl -sSI $BASE/posts/ -o /dev/null -w '%{http_code} %{redirect_url}\n'        # 308 to /posts
curl -sS $BASE/auth/login | grep -o '<meta name="robots"[^>]*>'                 # noindex, and robots.txt does not Disallow it
curl -sSI "https://<project>.vercel.app/" -o /dev/null -w '%{http_code} %{redirect_url}\n'  # 308 to $BASE/
curl -sSI "https://<project>.vercel.app/api/cron/automations" | head -n 1      # not a 308 to $BASE
curl -sSI $BASE/posts/category/<empty-slug> -o /dev/null -w '%{http_code}\n'   # 404
curl -sS $BASE/posts/rss.xml | head -c 400                                     # atom:link rel="self"; ≤50 items
```

`sitemap-with-image.xsd` (commit under `docs/seo/` with the implementation): a wrapper that `xs:import`s `https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd` and `https://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd`.

Also:

- **CDN purge:** the Phase 6 preview test. If it fails, the implementation drops custom `s-maxage` before the rest of this list is treated as passing.
- **Google Rich Results Test** on a post URL → Article + Breadcrumbs, 0 errors. Home page is not a rich-result type for site name; use the Schema Markup Validator.
- **Schema Markup Validator** on the home page → one Organization or LocalBusiness and one WebSite, 0 errors. NAP text matches `/contact` and the footer.
- **Lighthouse SEO** on a public post → 100.
- **Search Console:** Domain property (http/https/www). Submit only `https://<host>/sitemap.xml`. Check "Excluded by noindex" for auth, dashboard, search, and tags, and "Blocked by robots.txt" for `/api/` and `/documents/api/`.
- **Bing Webmaster Tools:** submit the same index (or import the GSC property) and confirm the sitemap is read. The robots `Sitemap:` line is not a substitute for that submission.
- Edu, when the course list ships: Rich Results Test on `/courses` reports Course list only, with at least 3 courses. It does not report Course info.

---

## 7. Acceptance (whole feature)

- One canonical https origin. Production `*.vercel.app` and the www/apex duplicate 308 to it. `/api/*` does not.
- `/sitemap.xml` is a valid `<sitemapindex>`. Every child is valid, ≤50,000 URLs and <50 MB. Only published, live, same-site, indexable URLs. lastmod is real, timezone-qualified, and not in the future. No changefreq/priority. Images are `image:loc` only, ≤1000 per URL.
- robots.txt disallows the API prefixes, allows `/auth` and tag pages, and lists the index.
- Auth, dashboard, search, and tag pages are noindex and crawlable. Empty archives are 404. Non-prod and custom branch domains are noindex with allow-all robots (or Deployment Protection).
- Post pages pass Rich Results (Article + Breadcrumbs). The home page exposes one Organization or LocalBusiness and one WebSite in one `@graph`. Headline is the full H1.
- A significant publish, unpublish, or edit updates the sitemap on the next request under the cache strategy Phase 6 verified. A no-op save does not move lastmod.
- A new content type is one source file plus one line in `config/sitemap-sources.ts`.
- IndexNow is off. `/legal/refund` is in the pages sitemap. RSS has at most 50 items and `atom:link rel="self"`.

---

## 8. Scope

Phases run in order. Phase 0 records decisions. Phases 1–3 are the URL helper, the sitemap registry, and robots/host behavior. Phases 4–5 are metadata and JSON-LD. Phase 6 is revalidation plus the CDN purge test. Phase 7 is the checklist and `docs/seo.md`. Q8 schema stays out of all seven phases.

Follow-ups, not this implementation: `content_updated_at`, `slug_redirects`, paginating `listPublishedPosts()`, moving public post reads off `createSSRClient()` for ISR, a scheduled-post cron, WebSub, and video sitemaps.

---

## 9. Open questions for Truman

1. **Canonical env var.** Keep `NEXT_PUBLIC_SITE_ORIGIN` (on `main`, used by sitemap/RSS/canonical) as primary and accept `NEXT_PUBLIC_APP_URL` (PR #12) as fallback, or rename everything to `NEXT_PUBLIC_APP_URL`? **Default:** keep `SITE_ORIGIN`, fallback `APP_URL`.
2. **Legal pages are duplicated.** `/privacy` + `/terms` (admin-setting HTML, have metadata) vs `/legal/privacy|terms` (markdown in `public/terms/`, client pages, no metadata; the footer links here). Which set is canonical? **Default:** `/privacy` and `/terms` canonical; `/legal/privacy` and `/legal/terms` 308 to them. **`/legal/refund` is settled:** it is the only refund copy, it stays, and it is in `staticRoutes`.
3. **OG image. Settled.** Cover image when `cover_image_url` is set. Generated 1200×630 card as the fallback. Matching `twitter-image` so OG and X agree.
4. **Tag archives. Settled.** `noindex, follow`, self-canonical, excluded from the sitemap, not listed in robots.txt. `indexTagArchives: true` still requires unique intro copy and at least 3 live posts before a tag is indexed or added to the sitemap.
5. **Starter's own `siteKey`.** `posts.website` CHECK only allows `edu | marketing-agent | afterallcare`. A new client site cloned from the starter needs its own value, which means a CHECK-constraint migration in that site's own DB. Is that the intended pattern, or should the starter ship a neutral value?
6. **Logo/OG assets.** None exist in `nextjs/public/`. Provide brand assets, or ship placeholders? Logo must be at least 112×112.
7. **AfterAllCare read path.** AfterAllCare shares Supabase `glplvrljdgowcwuubkau` with edu and marketing-agent. Its blog rows are not anon-readable. **Default:** the AfterAllCare sitemap source uses a server-only admin read (`createServerAdminClient` / `PRIVATE_SUPABASE_SERVICE_KEY`), filtered to `website = 'afterallcare'`, same as `afterallcare-pt` `main` `lib/blog-posts.ts`. No schema change. No service key in the client.
8. **Starter-only schema, on hold.** Approve a `content_updated_at` column (significant fields only) and a `slug_redirects` table (old path → current path) on the **starter** database `cyczlgdaocwueaacqxsh`? **Default until you say yes:** app-side write guard for lastmod, and `lookupSlugRedirect` on the 404 path returning null. Do not apply either migration to `glplvrljdgowcwuubkau`.
9. **Dashboard robots block.** Drop robots.txt Disallow for dashboard prefixes and rely on the login redirect plus `noindex`? **Default: yes.** `/api/` and `/documents/api/` stay disallowed.
10. **IndexNow.** Send publish/update/delete/redirect URLs to IndexNow? **Default: off** (`site.indexNow.enabled === false`). A clone opts in with the flag and `INDEXNOW_KEY`.

---

## How to port this to another app

For Edu, AfterAllCare, and marketing-agent. Assumes Next 15 App Router. The shared production database is `glplvrljdgowcwuubkau`. **Additive app code only. No schema changes on that project.** Starter migrations, `content_updated_at`, and `slug_redirects` stay off it.

1. **Copy** `nextjs/src/lib/seo/**`, `nextjs/src/components/seo/JsonLd.tsx`, `nextjs/src/config/site.ts`, `nextjs/src/config/sitemap-sources.ts`, `nextjs/src/app/sitemap.xml/route.ts`, `nextjs/src/app/sitemaps/[source]/[page]/route.ts`, the rewritten `robots.ts`, and `docs/seo/sitemap-with-image.xsd`.
   - **marketing-agent:** do **not** delete `app/sitemap.ts`. Blog PR #115 is merged on `trumantool/marketing-agent` `main`. That file already extends the static sitemap with `/blog`, `/blog/[slug]`, categories, and authors via `listSitemapEntries()` (`nextjs/src/lib/blog/public-read.ts`). It still sets `lastModified: new Date()` on static paths, `/blog`, categories, and authors, and it still emits `changeFrequency` and `priority` (posts use `post.updatedAt` but also still emit changefreq/priority). The port **extends that module**: keep `listSitemapEntries()` as the blog source, point blog URLs at `/blog/...`, stop stamping today's date, drop changefreq/priority, and apply the significant-change lastmod, `image:loc`, and live-row rules. If the registry is adopted, `sitemap.ts` becomes the caller that registers the existing blog source plus static paths. It is not replaced by a from-scratch file that forgets `/blog`.
   - **Edu and the starter** have no blog-extended sitemap to preserve. The starter deletes its thin `app/sitemap.ts` so it does not collide with `app/sitemap.xml/route.ts`. Edu has no `sitemap.ts` today; add the route handlers.
2. **Set config** in `src/config/site.ts`: `name`, `description`, `siteKey` (`edu` / `afterallcare` / `marketing-agent`). `business.type`: `EducationalOrganization` for Edu; `PhysicalTherapy` or another LocalBusiness subtype **with address** for AfterAllCare (otherwise the builder falls back to `Organization`); `Organization` for marketing-agent. `logo` (≥112px), `defaultOgImage`, `social`, `staticRoutes` (include the refund URL if that app has one), `noindexPaths` (middleware protected list plus `/auth`), `robotsDisallow` (`/api` and any documents API). Set `NEXT_PUBLIC_SITE_ORIGIN` in Vercel production. marketing-agent: stop using the hard-coded `PUBLIC_SITE_ORIGIN` as a second source of truth; feed it through `siteUrl()`. Leave `indexNow.enabled` false unless Truman turns it on for that host. `canonicalParams` stays `['page']`.
3. **Register content types.** One file per type, then one line in `config/sitemap-sources.ts`.
   - **Edu** (anon client is fine if that DB's RLS allows published courses/lessons; still filter explicitly). Add `published_at <= now()` — `lib/courses.ts` selects `published_at` and does not filter it today. Select `updated_at` (omitted from `POST_COLUMNS` today) for lastmod.

   ```ts
   export const coursesSource = defineSitemapSource({
     id: 'courses', tags: ['sitemap', 'sitemap:courses'],
     count: ({ db, siteKey }) => countLive(db.from('posts').select('id', { count: 'exact', head: true })
       .eq('website', siteKey).eq('type', 'course').eq('status', 'published').lte('published_at', now)),
     list: async ({ db, siteKey }, { offset, limit }) => (await db.from('posts')
       .select('slug, updated_at, published_at, cover_image_url')
       .eq('website', siteKey).eq('type', 'course').eq('status', 'published').lte('published_at', now)
       .order('id').range(offset, offset + limit - 1)).data!.map(r => ({
         path: `/courses/${r.slug}`,
         lastmod: maxDate(r.updated_at, r.published_at), // timezone-qualified; omit if both null
         images: r.cover_image_url ? [{ loc: r.cover_image_url }] : [] })),
   })
   // lessonsSource: published lessons whose parent course is published; path `/courses/${course.slug}/${lesson.slug}`
   ```

   - **AfterAllCare (Q7 default):** do not use the anon client. Copy the pattern in `afterallcare-pt` `nextjs/src/lib/blog-posts.ts`: `createServerAdminClient()` on the server only, `.eq('website','afterallcare').eq('type','blog').eq('status','published')`, and the same `published_at <= now()` gate if those rows schedule. The service key never reaches client code. The source still goes through the shared serializer so lastmod, image, and chunk rules match. No new table, no RLS edit, no migration on `glplvrljdgowcwuubkau`.
   - **marketing-agent:** the blog source calls `listSitemapEntries()` (already website-scoped in that app) and maps `/blog/${slug}`. Do not point marketing-agent posts at `/posts`.
4. **Revalidation.** On publish, unpublish, delete, or slug change, call `revalidatePostSeo` / `revalidateSitemap('<sourceId>')`. Edu: course/lesson save and the generation worker. A lesson change also refreshes `'courses'` when it moves the parent lastmod. Apply the significant-change guard so a no-op save does not bump lastmod. IndexNow stays off unless that app's config opts in.
5. **Metadata and JSON-LD.** `metadataBase` and defaults in the root layout. `buildMetadata({ path, query })` on every public template, with the `page` allow-list. noindex on auth and dashboard layouts. robots.txt does not Disallow those page prefixes. One `@graph` per page. Home: Organization or LocalBusiness (via `getBusinessNap()`) plus WebSite. Edu: `courseListJsonLd` on `/courses` (only when there are at least 3 courses; each course has `@id`, `name`, `description`, `provider`). `courseJsonLd` sets `@id` `${url}#course`. `lessonJsonLd` plus a visible breadcrumb on the lesson. Do not treat `offers` / `hasCourseInstance` as a Course Info rich result. marketing-agent: keep its existing Service/FAQ graph and merge it into the one script on those pages; add WebSite + Organization on the home page only.
6. **Host and trailing slash.** Same 308 to `siteUrl()` for the production alias and www/apex, exempting `/api/*`. Previews and custom branch domains: noindex header + allow-all robots, or Deployment Protection. Assert `curl -sI $BASE/<section>/` is 308 to the no-slash URL.
7. **Empty archives** 404. Tag pages, if any, are noindex with a self-canonical and are absent from robots.txt and the sitemap.
8. **RSS**, if the app has one: cap 50, `atom:link rel="self"`, absolute links, `lastBuildDate` from newest lastmod.
9. **Slug lookup.** Call `lookupSlugRedirect` on the 404 path. It returns null until Q8 is approved for the starter DB. Do not add the table on the shared project as part of the port.
10. **Verify** with §6 (xmllint, image:loc only, URL and byte caps, vercel.app 308, API not redirected, trailing slash, robots without `/auth`). Rich Results Test and Schema Markup Validator. For Edu, Course list on `/courses`, not Course info.
11. **Submit.** Search Console Domain property: only `https://<host>/sitemap.xml`. Bing Webmaster Tools: submit that same index or import from GSC. Confirm robots.txt has the same `Sitemap:` line.

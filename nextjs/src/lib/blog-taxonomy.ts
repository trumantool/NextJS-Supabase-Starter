import { createSSRClient } from '@/lib/supabase/server'
import type { PostWebsite } from '@/lib/posts'
import {
  isMissingBlogSchemaError,
  isPostSlug,
  logBlogSchemaGap,
  publicPostWebsite,
  slugifyTitle,
} from '@/lib/posts'
import type { RollAuthor } from '@/lib/blog-roll'
import {
  getPublishedPostBySlug,
  listPublishedPosts,
  listPublishedPostsByIds,
  listPublishedPostsForAuthor,
  type PublishedPost,
} from '@/lib/posts-store'

export type TermLink = { slug: string; name: string }

export type AuthorLink = {
  slug: string
  display_name: string
  bio: string | null
  title: string | null
  company: string | null
  location: string | null
  linkedin_url: string | null
}

const AUTHOR_COLUMN_ATTEMPTS = [
  'user_id, slug, display_name, bio, linkedin_url, title, company, location',
  'user_id, slug, display_name, bio, linkedin_url',
  'user_id, slug, display_name, bio',
] as const

type AuthorProfileRow = {
  user_id: string
  slug: string
  display_name: string
  bio: string | null
  linkedin_url?: string | null
  title?: string | null
  company?: string | null
  location?: string | null
}

function toAuthorLink(row: AuthorProfileRow): AuthorLink {
  return {
    slug: row.slug,
    display_name: row.display_name,
    bio: row.bio,
    title: row.title ?? null,
    company: row.company ?? null,
    location: row.location ?? null,
    linkedin_url: row.linkedin_url ?? null,
  }
}

async function selectAuthorRows(
  label: string,
  run: (columns: string) => Promise<{ data: AuthorProfileRow[] | null; error: { code?: string; message: string } | null }>
): Promise<AuthorProfileRow[] | null> {
  for (let index = 0; index < AUTHOR_COLUMN_ATTEMPTS.length; index += 1) {
    const result = await run(AUTHOR_COLUMN_ATTEMPTS[index])
    if (!result.error) return result.data ?? []
    const last = index === AUTHOR_COLUMN_ATTEMPTS.length - 1
    if (!isMissingBlogSchemaError(result.error) || last) {
      const missing = emptyOnSchemaError(result.error, [] as AuthorProfileRow[], label)
      return missing ?? null
    }
    logBlogSchemaGap(label, result.error)
  }
  return []
}

function readPublicWebsite(): PostWebsite | null {
  return publicPostWebsite(process.env.POSTS_WEBSITE)
}

function emptyOnSchemaError<T>(
  error: { code?: string; message: string } | null,
  empty: T,
  label: string
): T | undefined {
  if (!error) return undefined
  if (isMissingBlogSchemaError(error)) {
    logBlogSchemaGap(label, error)
    return empty
  }
  throw new Error(error.message)
}

export function parseTermNames(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(',')
    : typeof value === 'string'
      ? value
      : ''
  const seen = new Set<string>()
  const names: string[] = []
  for (const part of raw.split(',')) {
    const name = part.trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) continue
    const slug = slugifyTitle(name)
    if (!isPostSlug(slug)) continue
    const key = slug
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
    if (names.length >= 20) break
  }
  return names
}

async function uniqueAuthorSlug(
  website: PostWebsite,
  base: string
): Promise<string> {
  const supabase = await createSSRClient()
  let candidate = base
  for (let n = 2; n < 50; n += 1) {
    const { data, error } = await supabase
      .from('blog_author_profiles')
      .select('id')
      .eq('website', website)
      .eq('slug', candidate)
      .maybeSingle()
    const missing = emptyOnSchemaError(error, null, 'blog_author_profiles')
    if (missing !== undefined) return candidate
    if (!data) return candidate
    const suffix = `-${n}`
    candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`
  }
  throw new Error('Could not find a unique author slug')
}

export async function ensureAuthorProfile(userId: string, website: PostWebsite): Promise<void> {
  const supabase = await createSSRClient()
  const { data: existing, error } = await supabase
    .from('blog_author_profiles')
    .select('id')
    .eq('website', website)
    .eq('user_id', userId)
    .maybeSingle()
  const missingProfile = emptyOnSchemaError(error, null, 'blog_author_profiles')
  if (missingProfile !== undefined) return
  if (existing) return

  const { data: userData, error: userError } = await supabase
    .from('user_data')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (userError) throw new Error(userError.message)

  const display =
    [userData?.first_name, userData?.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim() || 'Author'
  const displayName = display.slice(0, 80)
  let base = slugifyTitle(displayName)
  if (!isPostSlug(base)) base = 'author'
  const slug = await uniqueAuthorSlug(website, base)

  const { error: insertError } = await supabase.from('blog_author_profiles').insert({
    website,
    user_id: userId,
    slug,
    display_name: displayName,
  })
  if (insertError && insertError.code !== '23505') {
    const missingInsert = emptyOnSchemaError(insertError, null, 'blog_author_profiles')
    if (missingInsert !== undefined) return
    throw new Error(insertError.message)
  }
}

async function upsertTerm(
  table: 'blog_categories' | 'blog_tags',
  website: PostWebsite,
  name: string
): Promise<string | null> {
  const supabase = await createSSRClient()
  const slug = slugifyTitle(name)
  const { data: existing, error } = await supabase
    .from(table)
    .select('id')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  const missing = emptyOnSchemaError(error, null, table)
  if (missing !== undefined) return null
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from(table)
    .insert({ website, slug, name: name.slice(0, 80) })
    .select('id')
    .single()
  if (insertError) {
    const missingInsert = emptyOnSchemaError(insertError, null, table)
    if (missingInsert !== undefined) return null
    if (insertError.code === '23505') {
      const { data: again, error: againError } = await supabase
        .from(table)
        .select('id')
        .eq('website', website)
        .eq('slug', slug)
        .single()
      if (againError) throw new Error(againError.message)
      return again.id
    }
    throw new Error(insertError.message)
  }
  return data.id
}

export async function syncPostTerms(
  postId: string,
  website: PostWebsite,
  categories: unknown,
  tags: unknown
): Promise<void> {
  const supabase = await createSSRClient()
  const categoryNames = parseTermNames(categories)
  const tagNames = parseTermNames(tags)

  const categoryIds: string[] = []
  for (const name of categoryNames) {
    const id = await upsertTerm('blog_categories', website, name)
    if (!id) return
    categoryIds.push(id)
  }
  const tagIds: string[] = []
  for (const name of tagNames) {
    const id = await upsertTerm('blog_tags', website, name)
    if (!id) return
    tagIds.push(id)
  }

  const { error: dropCategories } = await supabase
    .from('post_categories')
    .delete()
    .eq('post_id', postId)
  const missingCategories = emptyOnSchemaError(dropCategories, null, 'post_categories')
  if (missingCategories !== undefined) return
  if (dropCategories) throw new Error(dropCategories.message)
  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from('post_categories')
      .insert(categoryIds.map((category_id) => ({ post_id: postId, category_id })))
    if (emptyOnSchemaError(error, null, 'post_categories') !== undefined) return
  }

  const { error: dropTags } = await supabase.from('post_tags').delete().eq('post_id', postId)
  const missingTags = emptyOnSchemaError(dropTags, null, 'post_tags')
  if (missingTags !== undefined) return
  if (dropTags) throw new Error(dropTags.message)
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('post_tags')
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })))
    if (emptyOnSchemaError(error, null, 'post_tags') !== undefined) return
  }
}

const emptyTerms = { categories: [] as string[], tags: [] as string[] }
const emptyTermLinks = { categories: [] as TermLink[], tags: [] as TermLink[] }

export async function getPostTermNames(postId: string): Promise<{ categories: string[]; tags: string[] }> {
  const supabase = await createSSRClient()
  const { data: categoryLinks, error: categoryError } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  const missingCategoryLinks = emptyOnSchemaError(categoryError, emptyTerms, 'post_categories')
  if (missingCategoryLinks) return missingCategoryLinks
  const { data: tagLinks, error: tagError } = await supabase
    .from('post_tags')
    .select('tag_id')
    .eq('post_id', postId)
  const missingTagLinks = emptyOnSchemaError(tagError, emptyTerms, 'post_tags')
  if (missingTagLinks) return missingTagLinks

  const categoryIds = (categoryLinks ?? []).map((row) => row.category_id)
  const tagIds = (tagLinks ?? []).map((row) => row.tag_id)
  const categoryRows =
    categoryIds.length === 0
      ? { data: [] as { name: string }[], error: null }
      : await supabase.from('blog_categories').select('name').in('id', categoryIds)
  if (emptyOnSchemaError(categoryRows.error, emptyTerms, 'blog_categories')) return emptyTerms
  const tagRows =
    tagIds.length === 0
      ? { data: [] as { name: string }[], error: null }
      : await supabase.from('blog_tags').select('name').in('id', tagIds)
  if (emptyOnSchemaError(tagRows.error, emptyTerms, 'blog_tags')) return emptyTerms
  return {
    categories: categoryRows.data?.map((row) => row.name) ?? [],
    tags: tagRows.data?.map((row) => row.name) ?? [],
  }
}

async function livePostsByIds(ids: string[]): Promise<PublishedPost[]> {
  return listPublishedPostsByIds(ids)
}

export async function listPostsForCategory(slug: string): Promise<{ name: string; posts: PublishedPost[] } | null> {
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const { data: category, error } = await supabase
    .from('blog_categories')
    .select('id, name')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  const missing = emptyOnSchemaError(error, null, 'blog_categories')
  if (missing !== undefined) return missing
  if (!category) return null
  const { data: links, error: linkError } = await supabase
    .from('post_categories')
    .select('post_id')
    .eq('category_id', category.id)
  const missingLinks = emptyOnSchemaError(linkError, [] as { post_id: string }[], 'post_categories')
  const rows = missingLinks ?? links ?? []
  const posts = await livePostsByIds(rows.map((row) => row.post_id))
  return { name: category.name, posts }
}

export async function listPostsForTag(slug: string): Promise<{ name: string; posts: PublishedPost[] } | null> {
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const { data: tag, error } = await supabase
    .from('blog_tags')
    .select('id, name')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  const missing = emptyOnSchemaError(error, null, 'blog_tags')
  if (missing !== undefined) return missing
  if (!tag) return null
  const { data: links, error: linkError } = await supabase
    .from('post_tags')
    .select('post_id')
    .eq('tag_id', tag.id)
  const missingLinks = emptyOnSchemaError(linkError, [] as { post_id: string }[], 'post_tags')
  const rows = missingLinks ?? links ?? []
  const posts = await livePostsByIds(rows.map((row) => row.post_id))
  return { name: tag.name, posts }
}

export async function listPostsForAuthor(
  slug: string
): Promise<{ author: AuthorLink; posts: PublishedPost[] } | null> {
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const rows = await selectAuthorRows('blog_author_profiles', async (columns) => {
    const { data, error } = await supabase
      .from('blog_author_profiles')
      .select(columns as 'user_id, slug, display_name, bio')
      .eq('website', website)
      .eq('slug', slug)
      .maybeSingle()
    return { data: data ? [data as AuthorProfileRow] : [], error }
  })
  const author = rows?.[0]
  if (!author) return null
  const posts = await listPublishedPostsForAuthor(author.user_id)
  return { author: toAuthorLink(author), posts }
}

export async function listCategoryLinks(): Promise<TermLink[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_categories')
    .select('slug, name')
    .eq('website', website)
    .order('name', { ascending: true })
  const missing = emptyOnSchemaError(error, [] as TermLink[], 'blog_categories')
  if (missing) return missing
  return data ?? []
}

export async function listTagLinks(): Promise<TermLink[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_tags')
    .select('slug, name')
    .eq('website', website)
    .order('name', { ascending: true })
  const missing = emptyOnSchemaError(error, [] as TermLink[], 'blog_tags')
  if (missing) return missing
  return data ?? []
}

export async function authorsForUserIds(userIds: string[]): Promise<Record<string, RollAuthor>> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))]
  if (unique.length === 0) return {}
  const website = readPublicWebsite()
  if (!website) return {}
  const supabase = await createSSRClient()
  const rows = await selectAuthorRows('blog_author_profiles', async (columns) => {
    const { data, error } = await supabase
      .from('blog_author_profiles')
      .select(columns as 'user_id, slug, display_name, bio')
      .eq('website', website)
      .in('user_id', unique)
    return { data: (data as AuthorProfileRow[] | null) ?? [], error }
  })
  const map: Record<string, RollAuthor> = {}
  for (const row of rows ?? []) {
    map[row.user_id] = {
      slug: row.slug,
      displayName: row.display_name,
      title: row.title ?? null,
      company: row.company ?? null,
    }
  }
  return map
}

export async function newsletterBlockAvailable(): Promise<boolean> {
  try {
    const { createServerAdminClient } = await import('@/lib/supabase/serverAdminClient')
    const admin = await createServerAdminClient()
    const { error } = await admin.from('newsletter_subscribers').select('email').limit(1)
    if (!error) return true
    if (isMissingBlogSchemaError(error)) {
      logBlogSchemaGap('newsletter_subscribers', error)
      return false
    }
    console.warn(`newsletter probe: ${error.code ?? ''} ${error.message}`.trim())
    return false
  } catch (error) {
    console.warn('newsletter probe:', error instanceof Error ? error.message : error)
    return false
  }
}

export async function listAuthorLinks(): Promise<TermLink[]> {
  const website = readPublicWebsite()
  if (!website) return []
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_author_profiles')
    .select('slug, display_name')
    .eq('website', website)
    .order('display_name', { ascending: true })
  const missing = emptyOnSchemaError(error, [] as TermLink[], 'blog_author_profiles')
  if (missing) return missing
  return (data ?? []).map((row) => ({ slug: row.slug, name: row.display_name }))
}

export async function termsForPost(postId: string): Promise<{ categories: TermLink[]; tags: TermLink[] }> {
  const supabase = await createSSRClient()
  const { data: categoryLinks, error: categoryError } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  const missingCategoryLinks = emptyOnSchemaError(categoryError, emptyTermLinks, 'post_categories')
  if (missingCategoryLinks) return missingCategoryLinks
  const { data: tagLinks, error: tagError } = await supabase
    .from('post_tags')
    .select('tag_id')
    .eq('post_id', postId)
  const missingTagLinks = emptyOnSchemaError(tagError, emptyTermLinks, 'post_tags')
  if (missingTagLinks) return missingTagLinks
  const categoryIds = (categoryLinks ?? []).map((row) => row.category_id)
  const tagIds = (tagLinks ?? []).map((row) => row.tag_id)
  const categoryRows =
    categoryIds.length === 0
      ? { data: [] as TermLink[], error: null }
      : await supabase.from('blog_categories').select('slug, name').in('id', categoryIds)
  if (emptyOnSchemaError(categoryRows.error, emptyTermLinks, 'blog_categories')) return emptyTermLinks
  const tagRows =
    tagIds.length === 0
      ? { data: [] as TermLink[], error: null }
      : await supabase.from('blog_tags').select('slug, name').in('id', tagIds)
  if (emptyOnSchemaError(tagRows.error, emptyTermLinks, 'blog_tags')) return emptyTermLinks
  return { categories: categoryRows.data ?? [], tags: tagRows.data ?? [] }
}

export async function authorForPost(authorId: string | null): Promise<AuthorLink | null> {
  if (!authorId) return null
  const website = readPublicWebsite()
  if (!website) return null
  const supabase = await createSSRClient()
  const rows = await selectAuthorRows('blog_author_profiles', async (columns) => {
    const { data, error } = await supabase
      .from('blog_author_profiles')
      .select(columns as 'user_id, slug, display_name, bio')
      .eq('website', website)
      .eq('user_id', authorId)
      .maybeSingle()
    return { data: data ? [data as AuthorProfileRow] : [], error }
  })
  const row = rows?.[0]
  return row ? toAuthorLink(row) : null
}

export async function listRelatedPosts(postId: string): Promise<PublishedPost[]> {
  const supabase = await createSSRClient()
  const { data: links, error } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  const missingLinks = emptyOnSchemaError(error, [] as { category_id: string }[], 'post_categories')
  const categoryIds = (missingLinks ?? links ?? []).map((row) => row.category_id)
  if (missingLinks === undefined && categoryIds.length > 0) {
    const { data: siblings, error: siblingError } = await supabase
      .from('post_categories')
      .select('post_id')
      .in('category_id', categoryIds)
    const missingSiblings = emptyOnSchemaError(siblingError, [] as { post_id: string }[], 'post_categories')
    const ids = [...new Set((missingSiblings ?? siblings ?? []).map((row) => row.post_id).filter((id) => id !== postId))]
    const related = (await livePostsByIds(ids)).slice(0, 3)
    if (related.length > 0) return related
  }
  const latest = await listPublishedPosts()
  return latest.filter((post) => post.id !== postId).slice(0, 3)
}

export async function loadPublishedArticle(slug: string) {
  const post = await getPublishedPostBySlug(slug)
  if (!post) return null
  const [terms, author, related] = await Promise.all([
    termsForPost(post.id),
    authorForPost(post.author_id ?? null),
    listRelatedPosts(post.id),
  ])
  return { post, ...terms, author, related }
}

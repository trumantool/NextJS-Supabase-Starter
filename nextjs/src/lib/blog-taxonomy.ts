import { createSSRClient } from '@/lib/supabase/server'
import type { PostWebsite } from '@/lib/posts'
import { isPostSlug, requirePostWebsite, slugifyTitle } from '@/lib/posts'
import {
  getPublishedPostBySlug,
  listPublishedPosts,
  type PublishedPost,
} from '@/lib/posts-store'

export type TermLink = { slug: string; name: string }

export type AuthorLink = { slug: string; display_name: string; bio: string | null }

function currentWebsite(): PostWebsite {
  return requirePostWebsite(process.env.POSTS_WEBSITE)
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
    if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
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
  if (insertError && insertError.code !== '23505') throw new Error(insertError.message)
}

async function upsertTerm(
  table: 'blog_categories' | 'blog_tags',
  website: PostWebsite,
  name: string
): Promise<string> {
  const supabase = await createSSRClient()
  const slug = slugifyTitle(name)
  const { data: existing, error } = await supabase
    .from(table)
    .select('id')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing.id

  const { data, error: insertError } = await supabase
    .from(table)
    .insert({ website, slug, name: name.slice(0, 80) })
    .select('id')
    .single()
  if (insertError) {
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
    categoryIds.push(await upsertTerm('blog_categories', website, name))
  }
  const tagIds: string[] = []
  for (const name of tagNames) {
    tagIds.push(await upsertTerm('blog_tags', website, name))
  }

  const { error: dropCategories } = await supabase
    .from('post_categories')
    .delete()
    .eq('post_id', postId)
  if (dropCategories) throw new Error(dropCategories.message)
  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from('post_categories')
      .insert(categoryIds.map((category_id) => ({ post_id: postId, category_id })))
    if (error) throw new Error(error.message)
  }

  const { error: dropTags } = await supabase.from('post_tags').delete().eq('post_id', postId)
  if (dropTags) throw new Error(dropTags.message)
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('post_tags')
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })))
    if (error) throw new Error(error.message)
  }
}

export async function getPostTermNames(postId: string): Promise<{ categories: string[]; tags: string[] }> {
  const supabase = await createSSRClient()
  const { data: categoryLinks, error: categoryError } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  if (categoryError) throw new Error(categoryError.message)
  const { data: tagLinks, error: tagError } = await supabase
    .from('post_tags')
    .select('tag_id')
    .eq('post_id', postId)
  if (tagError) throw new Error(tagError.message)

  const categoryIds = (categoryLinks ?? []).map((row) => row.category_id)
  const tagIds = (tagLinks ?? []).map((row) => row.tag_id)
  const categories =
    categoryIds.length === 0
      ? []
      : (
          await supabase.from('blog_categories').select('name').in('id', categoryIds)
        ).data?.map((row) => row.name) ?? []
  const tags =
    tagIds.length === 0
      ? []
      : (await supabase.from('blog_tags').select('name').in('id', tagIds)).data?.map((row) => row.name) ?? []
  return { categories, tags }
}

async function livePostsByIds(ids: string[]): Promise<PublishedPost[]> {
  if (ids.length === 0) return []
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, website, type, title, slug, summary, body, cover_image_url, video_url, published_at, sort_order, author_id, updated_at')
    .eq('website', website)
    .eq('type', 'blog')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .in('id', ids)
    .order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PublishedPost[]
}

export async function listPostsForCategory(slug: string): Promise<{ name: string; posts: PublishedPost[] } | null> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data: category, error } = await supabase
    .from('blog_categories')
    .select('id, name')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!category) return null
  const { data: links, error: linkError } = await supabase
    .from('post_categories')
    .select('post_id')
    .eq('category_id', category.id)
  if (linkError) throw new Error(linkError.message)
  const posts = await livePostsByIds((links ?? []).map((row) => row.post_id))
  return { name: category.name, posts }
}

export async function listPostsForTag(slug: string): Promise<{ name: string; posts: PublishedPost[] } | null> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data: tag, error } = await supabase
    .from('blog_tags')
    .select('id, name')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!tag) return null
  const { data: links, error: linkError } = await supabase
    .from('post_tags')
    .select('post_id')
    .eq('tag_id', tag.id)
  if (linkError) throw new Error(linkError.message)
  const posts = await livePostsByIds((links ?? []).map((row) => row.post_id))
  return { name: tag.name, posts }
}

export async function listPostsForAuthor(
  slug: string
): Promise<{ author: AuthorLink; posts: PublishedPost[] } | null> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data: author, error } = await supabase
    .from('blog_author_profiles')
    .select('user_id, slug, display_name, bio')
    .eq('website', website)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!author) return null
  const { data, error: postError } = await supabase
    .from('posts')
    .select('id, website, type, title, slug, summary, body, cover_image_url, video_url, published_at, sort_order, author_id, updated_at')
    .eq('website', website)
    .eq('type', 'blog')
    .eq('status', 'published')
    .eq('author_id', author.user_id)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  if (postError) throw new Error(postError.message)
  return {
    author: { slug: author.slug, display_name: author.display_name, bio: author.bio },
    posts: (data ?? []) as PublishedPost[],
  }
}

export async function listCategoryLinks(): Promise<TermLink[]> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_categories')
    .select('slug, name')
    .eq('website', website)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listAuthorLinks(): Promise<TermLink[]> {
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_author_profiles')
    .select('slug, display_name')
    .eq('website', website)
    .order('display_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ slug: row.slug, name: row.display_name }))
}

export async function termsForPost(postId: string): Promise<{ categories: TermLink[]; tags: TermLink[] }> {
  const supabase = await createSSRClient()
  const { data: categoryLinks, error: categoryError } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  if (categoryError) throw new Error(categoryError.message)
  const { data: tagLinks, error: tagError } = await supabase
    .from('post_tags')
    .select('tag_id')
    .eq('post_id', postId)
  if (tagError) throw new Error(tagError.message)
  const categoryIds = (categoryLinks ?? []).map((row) => row.category_id)
  const tagIds = (tagLinks ?? []).map((row) => row.tag_id)
  const categories =
    categoryIds.length === 0
      ? []
      : (
          await supabase.from('blog_categories').select('slug, name').in('id', categoryIds)
        ).data ?? []
  const tags =
    tagIds.length === 0 ? [] : (await supabase.from('blog_tags').select('slug, name').in('id', tagIds)).data ?? []
  return { categories, tags }
}

export async function authorForPost(authorId: string | null): Promise<AuthorLink | null> {
  if (!authorId) return null
  const website = currentWebsite()
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_author_profiles')
    .select('slug, display_name, bio')
    .eq('website', website)
    .eq('user_id', authorId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return data
}

export async function listRelatedPosts(postId: string): Promise<PublishedPost[]> {
  const supabase = await createSSRClient()
  const { data: links, error } = await supabase
    .from('post_categories')
    .select('category_id')
    .eq('post_id', postId)
  if (error) throw new Error(error.message)
  const categoryIds = (links ?? []).map((row) => row.category_id)
  if (categoryIds.length > 0) {
    const { data: siblings, error: siblingError } = await supabase
      .from('post_categories')
      .select('post_id')
      .in('category_id', categoryIds)
    if (siblingError) throw new Error(siblingError.message)
    const ids = [...new Set((siblings ?? []).map((row) => row.post_id).filter((id) => id !== postId))]
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

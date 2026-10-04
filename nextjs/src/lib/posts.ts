const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
  return slug || 'post'
}

export function isPostSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 120 && SLUG.test(value)
}

export function isPostType(value: string): boolean {
  return value.length >= 1 && value.length <= 40 && SLUG.test(value)
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

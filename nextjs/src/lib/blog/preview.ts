const PREVIEW_LIMIT = 150
const BREAK_WINDOW = 40
const ELLIPSIS = '…'

function toPlain(source: string): string {
  return source
    .replace(/```[^\n]*\n?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Plain-text list preview. Computed when the admin list is read.
 * Prefer body. An empty body falls back to summary.
 */
export function postPreview(body: string | null | undefined, summary?: string | null): string {
  const primary = (body ?? '').trim()
  const source = primary || (summary ?? '')
  const text = toPlain(source)
  if (text.length <= PREVIEW_LIMIT) return text

  const head = text.slice(0, PREVIEW_LIMIT)
  const windowStart = PREVIEW_LIMIT - BREAK_WINDOW
  let cut = -1
  for (let index = PREVIEW_LIMIT - 1; index >= windowStart; index -= 1) {
    if (/\s/.test(head[index] ?? '')) {
      cut = index
      break
    }
  }
  if (cut === -1) return `${head}${ELLIPSIS}`
  return `${head.slice(0, cut).trimEnd()}${ELLIPSIS}`
}

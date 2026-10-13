import { youtubeNocookieSrc, youtubeVideoId } from './youtube'

const ALLOWED = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'br',
  'span',
  'mark',
  'sub',
  'sup',
  'iframe',
  'div',
])

const DROP_WITH_TEXT = new Set(['script', 'style'])
const VOID = new Set(['img', 'br', 'hr', 'iframe'])

type Attrs = Record<string, string>

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    .replace(/&#(\d+);?/g, (_, num: string) => {
      const code = Number(num)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    .replace(/&colon;/gi, ':')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** javascript:, data:, and vbscript: after trim, lowercase, and control-char stripping. */
export function isDangerousUrl(value: string): boolean {
  const normalized = decodeEntities(value)
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u0020]+/g, '')
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  )
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || isDangerousUrl(trimmed)) return false
  if (isHttpsUrl(trimmed)) return true
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')
}

function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {}
  const re = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  for (const match of source.matchAll(re)) {
    const name = match[1].toLowerCase()
    if (name.startsWith('on')) continue
    attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

function hasEventHandler(source: string): boolean {
  return /(?:^|\s)on[a-z0-9_-]+\s*=/i.test(source)
}

interface OpenTag {
  name: string
  attrs: Attrs
  rawAttrs: string
  selfClosing: boolean
}

function readTag(html: string, start: number): { tag: OpenTag | { close: string }; next: number } | null {
  if (html[start] !== '<') return null
  if (html.startsWith('<!--', start)) {
    const end = html.indexOf('-->', start + 4)
    return { tag: { close: '' }, next: end === -1 ? html.length : end + 3 }
  }
  const close = /^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/.exec(html.slice(start))
  if (close) return { tag: { close: close[1].toLowerCase() }, next: start + close[0].length }

  const open = /^<([a-zA-Z][a-zA-Z0-9]*)([^<>]*?)(\/?)>/.exec(html.slice(start))
  if (!open) return null
  const rawAttrs = open[2] ?? ''
  return {
    tag: {
      name: open[1].toLowerCase(),
      attrs: parseAttrs(rawAttrs),
      rawAttrs,
      selfClosing: open[3] === '/' || VOID.has(open[1].toLowerCase()),
    },
    next: start + open[0].length,
  }
}

function iframeHtml(attrs: Attrs): string {
  const id = youtubeVideoId(attrs.src ?? '')
  if (!id) return ''
  return `<iframe src="${escapeAttr(youtubeNocookieSrc(id))}"></iframe>`
}

function imgHtml(attrs: Attrs): string {
  const src = attrs.src ?? ''
  if (!isHttpsUrl(src) || isDangerousUrl(src)) return ''
  const alt = attrs.alt ?? ''
  const altAttr = alt ? ` alt="${escapeAttr(alt)}"` : ''
  return `<img src="${escapeAttr(src.trim())}"${altAttr}>`
}

function anchorOpen(attrs: Attrs): string | null {
  const href = attrs.href ?? ''
  if (!isSafeHref(href)) return null
  return `<a href="${escapeAttr(href.trim())}" rel="noopener noreferrer nofollow" target="_blank">`
}

interface Frame {
  name: string
  emitClose: boolean
  dropText: boolean
}

/**
 * Allowlist for the HTML tab. No new dependency.
 * Unsafe tags and URLs are removed before TipTap parses the string.
 */
export function sanitizeEditorHtml(html: string): string {
  const frames: Frame[] = []
  let out = ''
  let index = 0

  const dropping = () => frames.some((frame) => frame.dropText)

  while (index < html.length) {
    const lt = html.indexOf('<', index)
    if (lt === -1) {
      if (!dropping()) out += escapeText(html.slice(index))
      break
    }
    if (lt > index && !dropping()) out += escapeText(html.slice(index, lt))

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      index = end === -1 ? html.length : end + 3
      continue
    }

    const parsed = readTag(html, lt)
    if (!parsed || ('close' in parsed.tag && parsed.tag.close === '' && parsed.next === lt)) {
      if (!dropping()) out += '&lt;'
      index = lt + 1
      continue
    }

    if ('close' in parsed.tag) {
      const name = parsed.tag.close
      if (!name) {
        index = parsed.next
        continue
      }
      let found = -1
      for (let cursor = frames.length - 1; cursor >= 0; cursor -= 1) {
        if (frames[cursor].name === name) {
          found = cursor
          break
        }
      }
      if (found >= 0) {
        for (let cursor = frames.length - 1; cursor >= found; cursor -= 1) {
          const frame = frames[cursor]
          if (frame.emitClose && !VOID.has(frame.name)) out += `</${frame.name}>`
        }
        frames.length = found
      }
      index = parsed.next
      continue
    }

    const tag = parsed.tag
    index = parsed.next
    if (hasEventHandler(tag.rawAttrs)) {
      delete tag.attrs.onclick
    }

    if (DROP_WITH_TEXT.has(tag.name)) {
      if (!tag.selfClosing) frames.push({ name: tag.name, emitClose: false, dropText: true })
      continue
    }

    if (tag.name === 'iframe') {
      if (!dropping()) out += iframeHtml(tag.attrs)
      continue
    }

    if (tag.name === 'img') {
      if (!dropping()) out += imgHtml(tag.attrs)
      continue
    }

    if (!ALLOWED.has(tag.name)) {
      if (!tag.selfClosing) frames.push({ name: tag.name, emitClose: false, dropText: false })
      continue
    }

    if (tag.name === 'a') {
      const open = dropping() ? null : anchorOpen(tag.attrs)
      if (!open) {
        if (!tag.selfClosing) frames.push({ name: 'a', emitClose: false, dropText: false })
        continue
      }
      out += open
      if (!tag.selfClosing) frames.push({ name: 'a', emitClose: true, dropText: false })
      continue
    }

    if (!dropping()) out += `<${tag.name}>`
    if (!tag.selfClosing) frames.push({ name: tag.name, emitClose: !dropping(), dropText: false })
  }

  for (let cursor = frames.length - 1; cursor >= 0; cursor -= 1) {
    const frame = frames[cursor]
    if (frame.emitClose && !VOID.has(frame.name)) out += `</${frame.name}>`
  }
  return out
}

export function htmlTagNames(html: string): string[] {
  const names = new Set<string>()
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g
  for (const match of html.matchAll(re)) names.add(match[1].toLowerCase())
  return [...names].sort()
}

/** Tags in the sanitized input that TipTap did not keep. */
export function removedTagNames(beforeHtml: string, afterHtml: string): string[] {
  const after = new Set(htmlTagNames(afterHtml))
  return htmlTagNames(beforeHtml).filter((tag) => !after.has(tag))
}

export function removedTagWarning(beforeHtml: string, afterHtml: string): string | null {
  const removed = removedTagNames(beforeHtml, afterHtml)
  if (removed.length === 0) return null
  return `These tags were removed: ${removed.join(', ')}.`
}

export function imagesMissingAlt(html: string): boolean {
  const re = /<img\b([^>]*)>/gi
  for (const match of html.matchAll(re)) {
    const alt = parseAttrs(match[1] ?? '').alt
    if (!alt || !alt.trim()) return true
  }
  return false
}

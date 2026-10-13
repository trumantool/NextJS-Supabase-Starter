import { generateHTML, type JSONContent } from '@tiptap/core'
import { isTipTapDoc } from '@/lib/blog-doc'
import { blogExtensions } from '@/lib/blog/youtube-extension'

/** Schema HTML for a stored TipTap doc. Null means fall back to markdown. */
export function blogBodyHtml(doc: unknown): string | null {
  if (!isTipTapDoc(doc)) return null
  try {
    return generateHTML(doc as JSONContent, blogExtensions)
  } catch {
    return null
  }
}

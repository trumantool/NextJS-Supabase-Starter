import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bodyDocIsSafe } from '../blog-doc.ts'
import { postPreview } from './preview.ts'
import { imagesMissingAlt, removedTagWarning, sanitizeEditorHtml } from './html-sanitize.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../../..')

describe('blog parity with marketing-agent #150', () => {
  it('post preview is plain text with a 150-character cut', () => {
    assert.equal(postPreview('**Hello** [world](https://example.com) ![x](https://example.com/a.png)'), 'Hello world')
    assert.equal(postPreview('<p>Hi <strong>there</strong></p> <script>alert(1)</script>'), 'Hi there alert(1)')
    assert.equal(postPreview('short'), 'short')
    assert.equal(postPreview('   ', 'Fallback summary'), 'Fallback summary')
    assert.equal(postPreview('', ''), '')
    assert.equal(postPreview('a'.repeat(150)).includes('…'), false)
    assert.equal(postPreview('a'.repeat(150)).length, 150)

    const spaced = `${'a'.repeat(120)} ${'x'.repeat(30)}`
    assert.equal(spaced.length, 151)
    assert.equal(postPreview(spaced), `${'a'.repeat(120)}…`)

    const word = 'b'.repeat(151)
    assert.equal(postPreview(word), `${'b'.repeat(150)}…`)
  })

  it('editor html sanitizer strips active content and keeps youtube plus alt', () => {
    const script = sanitizeEditorHtml('<p>Keep</p><script>alert(1)</script><style>body{}</style>')
    assert.match(script, /Keep/)
    assert.equal(script.includes('alert'), false)
    assert.equal(script.includes('<script'), false)
    assert.equal(script.includes('<style'), false)

    const click = sanitizeEditorHtml('<p onclick="steal()">Hi</p>')
    assert.equal(click.includes('onclick'), false)
    assert.match(click, /Hi/)

    const jsHref = sanitizeEditorHtml('<a href="javascript:alert(1)">Go</a>')
    assert.equal(jsHref.includes('javascript:'), false)
    assert.match(jsHref, /Go/)
    assert.equal(jsHref.includes('<a'), false)

    const vimeo = sanitizeEditorHtml('<iframe src="https://player.vimeo.com/video/1"></iframe><p>After</p>')
    assert.equal(vimeo.includes('vimeo'), false)
    assert.equal(vimeo.includes('<iframe'), false)
    assert.match(vimeo, /After/)

    const youtube = sanitizeEditorHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>'
    )
    assert.match(youtube, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/)

    const image = sanitizeEditorHtml('<img src="https://cdn.example.com/a.png" alt="A cover">')
    assert.match(image, /alt="A cover"/)
    assert.equal(imagesMissingAlt('<img src="https://cdn.example.com/a.png">'), true)
    assert.equal(imagesMissingAlt(image), false)
    assert.equal(removedTagWarning('<p>Hi</p>', '<p>Hi</p>'), null)
    assert.match(removedTagWarning('<p><caption>Cap</caption></p>', '<p>Cap</p>') ?? '', /caption/)
  })

  it('rejects an unknown node and a javascript link', () => {
    assert.equal(
      bodyDocIsSafe([{ type: 'script', content: [{ type: 'text', text: 'nope' }] }]),
      false
    )
    assert.equal(
      bodyDocIsSafe([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href: ' javascript:alert(1)' } }],
            },
          ],
        },
      ]),
      false
    )
    assert.equal(
      bodyDocIsSafe([{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }]),
      true
    )
    const store = readFileSync(join(root, 'nextjs/src/lib/posts-store.ts'), 'utf8')
    assert.match(store, /bodyDocIsSafe/)
    assert.match(store, /The document is not valid\./)
    assert.match(store, /cover_image_alt/)
    assert.equal(store.includes('.delete('), false)
    assert.equal(store.includes('edu.is_admin'), false)
  })

  it('keeps TipTap mounted and prompts before leaving unsaved edits', () => {
    const editor = readFileSync(join(root, 'nextjs/src/components/posts/PostEditor.tsx'), 'utf8')
    const documentEditor = readFileSync(
      join(root, 'nextjs/src/app/(dashboard)/documents/components/DocumentEditor.tsx'),
      'utf8'
    )
    assert.match(editor, /hidden=\{tab === 'html'\}/)
    assert.equal(editor.includes("if (tab === 'html') return"), false)
    assert.match(editor, /hidden=\{tab === 'html'\}/)
    assert.match(editor, /editorRef=\{editorRef\}/)
    assert.match(editor, /sanitizeEditorHtml\(htmlDraft\)/)
    assert.match(editor, /setContent\(sanitized, true\)/)
    assert.match(editor, /beforeunload/)
    assert.match(editor, /Leave without saving\?/)
    assert.match(editor, /Cover image alt text/)
    assert.match(editor, /SEO title/)
    assert.match(editor, /aria-label="Open Graph image"/)
    assert.match(editor, /role="tablist"/)
    assert.equal(editor.includes('generateHTML'), false)
    assert.equal(editor.includes('generateJSON'), false)
    assert.equal(editor.includes('edu.is_admin'), false)
    assert.equal(editor.includes("'marketing-agent'"), false)
    assert.match(documentEditor, /hidden \? 'hidden'/)
    assert.match(documentEditor, /editorRef\.current = editor/)

    const nav = readFileSync(join(root, 'nextjs/src/components/MenuNav.tsx'), 'utf8')
    assert.match(nav, /<Link href="\/posts" className="text-gray-600 hover:text-gray-900">\s*Blog\s*<\/Link>/)
    assert.equal(nav.includes("href: '/posts'"), false)
  })
})

// Resume Builder — server-side .docx export.
// Converts a ProseMirror/TipTap document (JSON) into a valid .docx (OOXML)
// using a minimal, self-contained serializer. No external engine required.

import type { PmNode } from './types'

/** Escape XML special characters. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Serialization context — accumulates hyperlink + image relationships. */
interface Ctx {
  links: { rId: string; href: string }[]
  images: { rId: string; src: string }[]
  nextRel: number
}

function makeCtx(): Ctx {
  return { links: [], images: [], nextRel: 2 } // rId1=styles, rId2=numbering
}

function nextRel(ctx: Ctx): string {
  ctx.nextRel += 1
  return `rId${ctx.nextRel}`
}

/** Get (creating if needed) the relationship id for an external hyperlink. */
function linkRel(ctx: Ctx, href: string): string {
  const existing = ctx.links.find((l) => l.href === href)
  if (existing) return existing.rId
  const rId = nextRel(ctx)
  ctx.links.push({ rId, href })
  return rId
}

/** Get (creating if needed) the relationship id for an embedded image. */
function imageRel(ctx: Ctx, src: string): string {
  const existing = ctx.images.find((i) => i.src === src)
  if (existing) return existing.rId
  const rId = nextRel(ctx)
  ctx.images.push({ rId, src })
  return rId
}

/** Map a ProseMirror mark to OOXML run properties (rPr). */
function markProps(marks?: PmNode['marks']): string {
  let rPr = ''
  if (!marks) return rPr
  for (const m of marks) {
    if (m.type === 'bold') rPr += '<w:b/>'
    if (m.type === 'italic') rPr += '<w:i/>'
    if (m.type === 'underline') rPr += '<w:u w:val="single"/>'
    if (m.type === 'strike') rPr += '<w:strike/>'
    if (m.type === 'code') {
      rPr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'
      rPr += '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>'
    }
    if (m.type === 'highlight') rPr += '<w:highlight w:val="yellow"/>'
    if (m.type === 'subscript') rPr += '<w:vertAlign w:val="subscript"/>'
    if (m.type === 'superscript') rPr += '<w:vertAlign w:val="superscript"/>'
    if (m.type === 'textStyle') {
      const attrs = m.attrs ?? {}
      const color = attrs.color as string | undefined
      const fontSize = attrs.fontSize as string | undefined
      if (color) {
        const hex = color.replace(/^#/, '').toUpperCase()
        if (/^[0-9A-F]{6}$/.test(hex)) rPr += `<w:color w:val="${hex}"/>`
      }
      if (fontSize) {
        const pt = parseFloat(String(fontSize))
        if (Number.isFinite(pt)) rPr += `<w:sz w:val="${Math.round(pt * 2)}"/>`
      }
    }
  }
  return rPr
}

/** Return the href of the first link mark, if any. */
function linkHref(marks?: PmNode['marks']): string | null {
  const link = marks?.find((m) => m.type === 'link')
  const href = link?.attrs?.href
  return typeof href === 'string' && href ? href : null
}

/** Serialize a text node into a run (wrapped in a hyperlink when linked). */
function textRun(ctx: Ctx, node: PmNode): string {
  const text = esc(node.text ?? '')
  const rPr = markProps(node.marks)
  const run = `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`
  const href = linkHref(node.marks)
  return href
    ? `<w:hyperlink r:id="${linkRel(ctx, href)}" w:history="1">${run}</w:hyperlink>`
    : run
}

/** Serialize an image node into a drawing run. */
function imageRun(ctx: Ctx, node: PmNode): string {
  const src = String(node.attrs?.src ?? '')
  const rId = imageRel(ctx, src)
  const emu = 4389120 // ~1in; keeps embedded images bounded
  const drawing = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu}" cy="${emu}"/><wp:docPr id="1" name="Picture 1"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Picture 1"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu}" cy="${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  return `<w:r>${drawing}</w:r>`
}

/** Serialize an inline child (text/image/hardBreak) into run markup. */
function inlineRun(ctx: Ctx, child: PmNode): string {
  if (child.type === 'text') return textRun(ctx, child)
  if (child.type === 'image') return imageRun(ctx, child)
  if (child.type === 'hardBreak') return '<w:r><w:br/></w:r>'
  return ''
}

/** Build the <w:pPr> (or '') for a paragraph/heading given alignment + extras. */
function paraPPr(node: PmNode, extra: string): string {
  let inner = ''
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 1)
    inner += `<w:outlineLvl w:val="${level - 1}"/>`
  }
  if (node.attrs?.textAlign) {
    inner += `<w:jc w:val="${esc(String(node.attrs.textAlign))}"/>`
  }
  inner += extra
  return inner ? `<w:pPr>${inner}</w:pPr>` : ''
}

/** Serialize a paragraph or heading into a <w:p>. */
function paragraph(ctx: Ctx, node: PmNode): string {
  const runs = (node.content ?? []).map((c) => inlineRun(ctx, c)).join('')
  return `<w:p>${paraPPr(node, '')}${runs}</w:p>`
}

/** Serialize a list item (bullet or ordered) into a <w:p> with numbering. */
function listItem(ctx: Ctx, node: PmNode, ordered: boolean): string {
  const runs = (node.content ?? []).map((c) => inlineRun(ctx, c)).join('')
  const numId = ordered ? 2 : 1
  const pPr = `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>`
  return `<w:p>${pPr}${runs}</w:p>`
}

/** Serialize a task item: numbering + a checkbox glyph run. */
function taskItem(ctx: Ctx, node: PmNode): string {
  const checked = node.attrs?.checked === true
  const glyph = checked ? '☑' : '☐'
  const paragraphs = (node.content ?? []).filter((c) => c.type === 'paragraph')
  const runs = paragraphs
    .map((p) => (p.content ?? []).map((c) => inlineRun(ctx, c)).join(''))
    .join('')
  const pPr = `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>`
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${glyph} </w:t></w:r>${runs}</w:p>`
}

/** Serialize a blockquote — child paragraphs get a left border + indent. */
function blockquote(ctx: Ctx, node: PmNode): string {
  const border = `<w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="999999"/></w:pBdr><w:ind w:left="480"/>`
  return (node.content ?? [])
    .map((child) => {
      if (child.type === 'paragraph') {
        const runs = (child.content ?? []).map((c) => inlineRun(ctx, c)).join('')
        return `<w:p>${paraPPr(child, border)}${runs}</w:p>`
      }
      return serializeBlock(ctx, child, false)
    })
    .join('')
}

/** Serialize a code block — monospace + shading, preserving newlines. */
function codeBlock(node: PmNode): string {
  const text = (node.content ?? []).map((c) => c.text ?? '').join('')
  const lines = text.split('\n')
  const rPr = `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F7F7F7"/></w:rPr>`
  const runs = lines
    .map((line, i) => {
      const t = `<w:t xml:space="preserve">${esc(line)}</w:t>`
      const br = i < lines.length - 1 ? '<w:br/>' : ''
      return `<w:r>${rPr}${t}${br}</w:r>`
    })
    .join('')
  return `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F7F7F7"/></w:pPr>${runs}</w:p>`
}

/** Serialize a horizontal rule as an empty paragraph with a bottom border. */
function horizontalRule(): string {
  const pPr = `<w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr>`
  return `<w:p>${pPr}</w:p>`
}

/** Serialize a table node into <w:tbl>. */
function table(ctx: Ctx, node: PmNode): string {
  const rows = (node.content ?? []).map((row) => tableRow(ctx, row)).join('')
  const borders = `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/></w:tblBorders>`
  const tblPr = `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>`
  return `<w:tbl>${tblPr}${rows}</w:tbl>`
}

function tableRow(ctx: Ctx, node: PmNode): string {
  const cells = (node.content ?? []).map((c) => tableCell(ctx, c)).join('')
  return `<w:tr>${cells}</w:tr>`
}

function tableCell(ctx: Ctx, node: PmNode): string {
  const isHeader = node.type === 'tableHeader'
  const shd = isHeader
    ? '<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/></w:tcPr>'
    : ''
  const paras = (node.content ?? []).map((p) => paragraph(ctx, p)).join('')
  return `<w:tc>${shd}${paras}</w:tc>`
}

/** Dispatch a block-level node to the correct serializer. */
function serializeBlock(ctx: Ctx, node: PmNode, ordered = false): string {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return paragraph(ctx, node)
    case 'bulletList':
      return (node.content ?? []).map((li) => listItem(ctx, li, false)).join('')
    case 'orderedList':
      return (node.content ?? []).map((li) => listItem(ctx, li, true)).join('')
    case 'listItem':
      return listItem(ctx, node, ordered)
    case 'taskList':
      return (node.content ?? []).map((li) => taskItem(ctx, li)).join('')
    case 'taskItem':
      return taskItem(ctx, node)
    case 'blockquote':
      return blockquote(ctx, node)
    case 'codeBlock':
      return codeBlock(node)
    case 'horizontalRule':
      return horizontalRule()
    case 'table':
      return table(ctx, node)
    case 'image':
      return imageRun(ctx, node)
    default:
      return paragraph(ctx, node)
  }
}

/** Build the document.xml body from a ProseMirror doc. */
function buildBody(ctx: Ctx, doc: PmNode): string {
  return (doc.content ?? []).map((node) => serializeBlock(ctx, node, false)).join('')
}

/** Minimal numbering.xml for bullet + ordered lists. */
function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`
}

function documentXml(ctx: Ctx, doc: PmNode): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${buildBody(ctx, doc)}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`
}

function contentTypesXml(hasImages: boolean): string {
  const imageDefaults = hasImages
    ? '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
    : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageDefaults}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
}

function relsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

function documentRelsXml(
  ctx: Ctx,
  images: { rId: string; fileName: string }[]
): string {
  const parts = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
  ]
  for (const l of ctx.links) {
    parts.push(
      `<Relationship Id="${l.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.href)}" TargetMode="External"/>`
    )
  }
  for (const img of images) {
    parts.push(
      `<Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${img.fileName}"/>`
    )
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${parts.join('\n  ')}
</Relationships>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="table" w:default="1" w:styleId="NormalTable"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="NormalTable"/></w:style>
</w:styles>`
}

/** 1x1 transparent PNG used as a placeholder when an image cannot be fetched. */
const TRANSPARENT_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function decodeBase64(data: string): Uint8Array {
  const binary = Buffer.from(data, 'base64')
  return new Uint8Array(binary)
}

function imageKind(src: string): { fileName: string } {
  const m = /\.(png|jpe?g)(?:[?#]|$)/i.exec(src)
  return m && m[1].toLowerCase() === 'png'
    ? { fileName: 'image.png' }
    : { fileName: 'image.jpeg' }
}

/** Build a .docx as a Uint8Array from a ProseMirror doc (async: embeds images). */
export async function buildDocx(doc: PmNode): Promise<Uint8Array> {
  const ctx = makeCtx()
  const documentXmlContent = documentXml(ctx, doc)

  // Fetch embedded images server-side; fall back to a 1x1 PNG on failure so the
  // document is always valid.
  const mediaFiles: { rId: string; fileName: string; bytes: Uint8Array }[] = []
  for (const img of ctx.images) {
    const { fileName } = imageKind(img.src)
    let bytes: Uint8Array
    try {
      const res = await fetch(img.src)
      if (!res.ok) throw new Error('bad status')
      const buf = await res.arrayBuffer()
      const arr = new Uint8Array(buf)
      bytes = arr.length > 0 ? arr : decodeBase64(TRANSPARENT_1PX)
    } catch {
      bytes = decodeBase64(TRANSPARENT_1PX)
    }
    mediaFiles.push({ rId: img.rId, fileName, bytes })
  }

  const hasImages = ctx.images.length > 0
  const files: Record<string, string | Uint8Array> = {
    '[Content_Types].xml': contentTypesXml(hasImages),
    '_rels/.rels': relsXml(),
    'word/document.xml': documentXmlContent,
    'word/numbering.xml': numberingXml(),
    'word/styles.xml': stylesXml(),
    'word/_rels/document.xml.rels': documentRelsXml(ctx, mediaFiles),
  }
  for (const img of mediaFiles) {
    files[`word/media/${img.fileName}`] = img.bytes
  }

  return buildZip(files)
}

/**
 * Minimal ZIP writer (store, no compression) producing a valid .docx.
 * A .docx is just a ZIP archive with the OOXML parts above. Accepts both
 * string and binary (Uint8Array) file content.
 */
function buildZip(files: Record<string, string | Uint8Array>): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: { name: string; offset: number; size: number; crc: number }[] = []
  let offset = 0

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes)
    offset += bytes.length
  }

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const data = typeof content === 'string' ? encoder.encode(content) : content
    const crc = crc32(data)
    const localHeaderOffset = offset

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true) // signature
    dv.setUint16(4, 20, true) // version needed
    dv.setUint16(6, 0x0800, true) // flags (UTF-8)
    dv.setUint16(8, 0, true) // method: store
    dv.setUint16(10, 0, true) // mod time
    dv.setUint16(12, 0x21, true) // mod date
    dv.setUint32(14, crc, true)
    dv.setUint32(18, data.length, true) // compressed size
    dv.setUint32(22, data.length, true) // uncompressed size
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true) // extra length
    local.set(nameBytes, 30)

    push(local)
    central.push({ name, offset: localHeaderOffset, size: data.length, crc })
    push(data)
  }

  // Central directory
  const centralStart = offset
  for (const entry of central) {
    const nameBytes = encoder.encode(entry.name)
    const cd = new Uint8Array(46 + nameBytes.length)
    const dv = new DataView(cd.buffer)
    dv.setUint32(0, 0x02014b50, true) // signature
    dv.setUint16(4, 20, true) // version made by
    dv.setUint16(6, 20, true) // version needed
    dv.setUint16(8, 0x0800, true) // flags
    dv.setUint16(10, 0, true) // method
    dv.setUint16(12, 0, true) // mod time
    dv.setUint16(14, 0x21, true) // mod date
    dv.setUint32(16, entry.crc, true) // crc
    dv.setUint32(20, entry.size, true) // compressed size
    dv.setUint32(24, entry.size, true) // uncompressed size
    dv.setUint16(28, nameBytes.length, true)
    dv.setUint16(30, 0, true) // extra
    dv.setUint16(32, 0, true) // comment
    dv.setUint16(34, 0, true) // disk
    dv.setUint16(36, 0, true) // internal attrs
    dv.setUint32(38, 0, true) // external attrs
    dv.setUint32(42, entry.offset, true) // local header offset
    cd.set(nameBytes, 46)
    push(cd)
  }

  const centralSize = offset - centralStart

  // End of central directory
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true) // signature
  edv.setUint16(4, 0, true) // disk
  edv.setUint16(6, 0, true) // cd start disk
  edv.setUint16(8, central.length, true) // entries on disk
  edv.setUint16(10, central.length, true) // total entries
  edv.setUint32(12, centralSize, true) // cd size
  edv.setUint32(16, centralStart, true) // cd offset
  edv.setUint16(20, 0, true) // comment length
  push(eocd)

  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    out.set(c, pos)
    pos += c.length
  }
  return out
}

/** CRC-32 (IEEE) used by the ZIP format. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
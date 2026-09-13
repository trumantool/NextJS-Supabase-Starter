const GH_HOST_ALLOWLIST = new Set(['github.com', 'raw.githubusercontent.com'])
export const MAX_SKILL_BYTES = 512 * 1024
export const ALLOWED_SKILL_EXT = /\.(md|markdown|txt|json|ya?ml)$/i
export const AGENT_SKILLS_BUCKET = 'agent-skills'

const NAME_KEYS = new Set(['name', 'title', 'skill_name', 'skill'])
const DESC_KEYS = new Set(['description', 'desc', 'summary', 'skill_description'])

export type SkillFrontmatter = {
  name?: string
  description?: string
}

export function sanitizeSkillFilename(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || 'skill.md'
  return decodeURIComponent(base).replace(/[^0-9a-zA-Z!\-_.*'()]/g, '_')
}

export function skillFilenameStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || 'skill'
}

export function isAllowedSkillFilename(filename: string): boolean {
  return ALLOWED_SKILL_EXT.test(filename)
}

function unquoteYamlValue(raw: string): string {
  const value = raw.trim()
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1)
  }
  return value
}

/** Parse YAML frontmatter (`---` … `---`) for skill name/description. */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  if (!content.startsWith('---')) return {}
  const afterDashes = content.slice(3)
  if (!afterDashes.startsWith('\n') && !afterDashes.startsWith('\r\n')) return {}
  const afterOpen = afterDashes.replace(/^\r?\n/, '')
  const endMatch = afterOpen.match(/\r?\n---(?:\r?\n|$)/)
  if (!endMatch || endMatch.index === undefined) return {}
  const yaml = afterOpen.slice(0, endMatch.index)
  const fields: Record<string, string> = {}
  const lines = yaml.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].toLowerCase()
    const rawValue = kv[2].trim()
    if (rawValue === '|' || rawValue === '>' || rawValue === '|-' || rawValue === '>-') {
      const block: string[] = []
      while (i + 1 < lines.length && /^(?: {2,}|\t)/.test(lines[i + 1])) {
        i += 1
        block.push(lines[i].replace(/^(?: {2,}|\t)/, ''))
      }
      fields[key] = block.join('\n').trim()
      continue
    }
    if (!rawValue || rawValue.startsWith('[') || rawValue.startsWith('{')) continue
    fields[key] = unquoteYamlValue(rawValue)
  }

  const nameKey = Object.keys(fields).find((k) => NAME_KEYS.has(k))
  const descKey = Object.keys(fields).find((k) => DESC_KEYS.has(k))
  const result: SkillFrontmatter = {}
  if (nameKey && fields[nameKey]) result.name = fields[nameKey]
  if (descKey && fields[descKey]) result.description = fields[descKey]
  return result
}

export function resolveSkillMetadata(opts: {
  content: string
  explicitName?: string | null
  explicitDescription?: string | null
  fallbackName: string
}): { skillName: string; skillDescription: string | null } {
  const fm = parseSkillFrontmatter(opts.content)
  const nameOverride = opts.explicitName?.trim()
  const descOverride = opts.explicitDescription?.trim()
  const skillName = nameOverride || fm.name?.trim() || opts.fallbackName
  const skillDescription = descOverride || fm.description?.trim() || null
  return { skillName, skillDescription }
}

export function stripSkillFrontmatter(content: string): string {
  const text = content.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return text
  const afterDashes = text.slice(3)
  if (!afterDashes.startsWith('\n') && !afterDashes.startsWith('\r\n')) return text
  const afterOpen = afterDashes.replace(/^\r?\n/, '')
  const endMatch = afterOpen.match(/\r?\n---(?:\r?\n|$)/)
  if (!endMatch || endMatch.index === undefined) return text
  return afterOpen.slice(endMatch.index + endMatch[0].length)
}

export function prepareSkillPreviewBody(content: string): string {
  return stripSkillFrontmatter(content).replace(/^\s*\n/, '')
}

export type SignedSkillUrlResult = {
  data?: { signedUrl?: string | null } | null
  error?: { message?: string } | null
}

export async function loadSkillFileText(
  objectKey: string,
  sign: (key: string, expiresInSec?: number) => Promise<SignedSkillUrlResult>,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const { data, error } = await sign(objectKey, 60)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'No signed URL')
  }
  const res = await fetchImpl(data.signedUrl)
  if (!res.ok) {
    throw new Error(`Failed to load skill (${res.status})`)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength > MAX_SKILL_BYTES) {
    throw new Error('Skill file too large (max 512 KB)')
  }
  return new TextDecoder().decode(buf)
}

export function normalizeGitHubRawUrl(input: string): string {
  const u = new URL(input)
  if (!GH_HOST_ALLOWLIST.has(u.hostname)) {
    throw new Error('Only GitHub URLs are allowed')
  }
  if (u.hostname === 'raw.githubusercontent.com') return u.toString()
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (!m) {
    throw new Error('Use a link to a file (…/blob/<ref>/<path>) or a raw URL')
  }
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`
}

export async function fetchGitHubSkill(
  inputUrl: string
): Promise<{ filename: string; content: string }> {
  const rawUrl = normalizeGitHubRawUrl(inputUrl)
  const res = await fetch(rawUrl, { redirect: 'error' })
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'GitHub file not found. Private repositories are not supported.'
        : `GitHub fetch failed (${res.status})`
    )
  }
  const ct = res.headers.get('content-type') ?? ''
  if (ct && !/^text\/|application\/(json|x-yaml|octet-stream)/.test(ct)) {
    throw new Error(`Unexpected content-type: ${ct}`)
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength > MAX_SKILL_BYTES) {
    throw new Error('Skill file too large (max 512 KB)')
  }
  const filename = sanitizeSkillFilename(rawUrl.split('/').pop() || 'skill.md')
  if (!isAllowedSkillFilename(filename)) {
    throw new Error('Only text skill files are allowed (.md, .txt, .json, .yml, .yaml)')
  }
  return { filename, content: new TextDecoder().decode(buf) }
}

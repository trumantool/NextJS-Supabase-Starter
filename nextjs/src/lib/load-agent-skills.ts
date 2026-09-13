import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_SKILLS_BUCKET, stripSkillFrontmatter } from '@/lib/agent-skills'
import { isUuid } from '@/lib/ids'

export const MAX_CHAT_SKILLS = 8
export const MAX_SKILL_BODY_BYTES = 64 * 1024

export const SKILL_TRUNCATE_NOTE = 'Skill content truncated to 64 KB.'

export type SkillPromptPart = {
  name: string
  body: string
}

export type LoadedAgentSkills = {
  promptSection: string
  notes: string[]
}

export function isSkillVisibleToOwner(
  ownerUserId: string,
  skillUserId: string | null
): boolean {
  return skillUserId === null || skillUserId === ownerUserId
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function truncateUtf8(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const encoded = new TextEncoder().encode(text)
  if (encoded.length <= maxBytes) return text
  return new TextDecoder('utf-8', { fatal: false }).decode(encoded.slice(0, maxBytes))
}

export function applySkillBodyCap(skills: SkillPromptPart[]): {
  skills: SkillPromptPart[]
  truncated: boolean
} {
  const out: SkillPromptPart[] = []
  let used = 0
  let truncated = false

  for (const skill of skills) {
    const remaining = MAX_SKILL_BODY_BYTES - used
    if (remaining <= 0) {
      truncated = true
      break
    }
    const size = utf8ByteLength(skill.body)
    if (size <= remaining) {
      out.push(skill)
      used += size
      continue
    }
    out.push({ name: skill.name, body: truncateUtf8(skill.body, remaining) })
    truncated = true
    break
  }

  return { skills: out, truncated }
}

export function buildLoadedSkillsPrompt(skills: SkillPromptPart[]): string {
  if (skills.length === 0) return ''
  const blocks = skills.map((skill) => `### ${skill.name}\n${skill.body}`)
  return `\n\n## Loaded skills\n\n${blocks.join('\n\n')}`
}

/**
 * Service-role or SSR downloads must stay under the owner's folder or shared/.
 * Rejects `..` segments, absolute paths, and any other prefix.
 */
export function isAllowedSkillObjectKey(objectKey: string, ownerUserId: string): boolean {
  if (typeof objectKey !== 'string' || !objectKey) return false
  if (typeof ownerUserId !== 'string' || !ownerUserId) return false
  if (objectKey.startsWith('/') || objectKey.startsWith('\\')) return false
  if (objectKey.split(/[/\\]/).some((segment) => segment === '..')) return false
  return objectKey.startsWith(`${ownerUserId}/`) || objectKey.startsWith('shared/')
}

/**
 * Load skill markdown for an agent's skill_ids and format it as system context.
 * Shared with a future automations worker (Phase 6). No Composio / toolkits.
 */
export async function loadAgentSkills(opts: {
  supabase: SupabaseClient
  ownerUserId: string
  skillIds: string[] | null | undefined
}): Promise<LoadedAgentSkills> {
  const notes: string[] = []
  const rawIds = Array.isArray(opts.skillIds) ? opts.skillIds : []
  if (rawIds.length === 0) {
    return { promptSection: '', notes }
  }

  let ids = rawIds.filter((id) => isUuid(id))
  if (ids.length > MAX_CHAT_SKILLS) {
    ids = ids.slice(0, MAX_CHAT_SKILLS)
    notes.push(`Only the first ${MAX_CHAT_SKILLS} skills were loaded.`)
  }

  const parts: SkillPromptPart[] = []

  for (const id of ids) {
    const { data: row, error } = await opts.supabase
      .from('agent_skills')
      .select('id, user_id, skill_name, skill_url')
      .eq('id', id)
      .maybeSingle()

    if (error || !row || !isSkillVisibleToOwner(opts.ownerUserId, row.user_id)) {
      notes.push(`Skipped skill ${id}: deleted or not readable.`)
      continue
    }

    const objectKey = typeof row.skill_url === 'string' ? row.skill_url : ''
    if (!objectKey) {
      notes.push(`Skipped skill ${row.skill_name || id}: could not read file.`)
      continue
    }

    if (!isAllowedSkillObjectKey(objectKey, opts.ownerUserId)) {
      notes.push(`Skipped skill ${row.skill_name || id}: storage path is not allowed.`)
      continue
    }

    try {
      const { data: blob, error: downloadError } = await opts.supabase.storage
        .from(AGENT_SKILLS_BUCKET)
        .download(objectKey)
      if (downloadError || !blob) {
        notes.push(`Skipped skill ${row.skill_name || id}: could not read file.`)
        continue
      }
      const raw = await blob.text()
      const body = stripSkillFrontmatter(raw).trim()
      parts.push({
        name: row.skill_name || 'Untitled skill',
        body,
      })
    } catch (err) {
      console.error('loadAgentSkills: download failed', id, err)
      notes.push(`Skipped skill ${row.skill_name || id}: could not read file.`)
    }
  }

  const capped = applySkillBodyCap(parts)
  if (capped.truncated) {
    notes.push(SKILL_TRUNCATE_NOTE)
  }

  return {
    promptSection: buildLoadedSkillsPrompt(capped.skills),
    notes,
  }
}

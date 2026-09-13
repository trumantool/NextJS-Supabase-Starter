'use server'

import { revalidatePath } from 'next/cache'
import { createSSRClient } from '@/lib/supabase/server'
import {
  ALLOWED_SKILL_EXT,
  MAX_SKILL_BYTES,
  fetchGitHubSkill,
  isAllowedSkillFilename,
  resolveSkillMetadata,
  sanitizeSkillFilename,
  skillFilenameStem,
} from '@/lib/agent-skills'
import type { Tables } from '@/lib/types'

export type AgentSkillRow = Tables<'agent_skills'>

export type ActionResult<T = void> = {
  success: boolean
  message: string
  data?: T
}

type Supabase = Awaited<ReturnType<typeof createSSRClient>>

function fail<T = void>(message: string): ActionResult<T> {
  return { success: false, message }
}

function ok<T>(message: string, data?: T): ActionResult<T> {
  return { success: true, message, data }
}

function uniqueConflictMessage(error: { message?: string }): string {
  const msg = error.message ?? ''
  if (msg.includes('skill_url') || msg.includes('agent_skills_skill_url')) {
    return 'A skill file with this name already exists. Choose a different file name.'
  }
  if (
    msg.includes('personal_name_unique') ||
    msg.includes('shared_name_unique') ||
    msg.includes('skill_name')
  ) {
    return 'A skill with this name already exists in this library. Choose a different name.'
  }
  return 'This skill already exists. Choose a different name or file.'
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === '23505'
}

function isStorageExistsError(error: { message?: string; statusCode?: string | number }): boolean {
  const code = String(error.statusCode ?? '')
  const msg = (error.message ?? '').toLowerCase()
  return code === '409' || msg.includes('already exists') || msg.includes('duplicate')
}

async function requireUser(): Promise<
  { supabase: Supabase; userId: string } | { error: ActionResult<never> }
> {
  const supabase = await createSSRClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: fail<never>('You must be signed in to manage skills.') }
  }
  return { supabase, userId: user.id }
}

async function isAdmin(supabase: Supabase, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_data')
    .select('user_role')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.user_role === 'admin'
}

async function ensureFolder(supabase: Supabase, prefix: string): Promise<void> {
  await supabase.storage.from('agent-skills').upload(`${prefix}/`, new Blob([]), {
    upsert: true,
  })
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function nameTaken(
  supabase: Supabase,
  skillName: string,
  shared: boolean,
  userId: string
): Promise<boolean> {
  let query = supabase
    .from('agent_skills')
    .select('id')
    .ilike('skill_name', escapeIlike(skillName))
    .limit(1)
  query = shared ? query.is('user_id', null) : query.eq('user_id', userId)
  const { data } = await query
  return Boolean(data && data.length > 0)
}

async function urlTaken(supabase: Supabase, skillUrl: string): Promise<boolean> {
  const { data } = await supabase
    .from('agent_skills')
    .select('id')
    .eq('skill_url', skillUrl)
    .maybeSingle()
  return Boolean(data)
}

async function writeSkill(opts: {
  shared: boolean
  filename: string
  body: Blob
  contentType: string
  skillName: string
  skillDescription: string | null
  source: 'upload' | 'github'
  sourceUrl?: string | null
}): Promise<ActionResult<AgentSkillRow>> {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { supabase, userId } = auth

  if (opts.shared) {
    if (!(await isAdmin(supabase, userId))) {
      return fail('Only admins can manage shared skills.')
    }
    await ensureFolder(supabase, 'shared')
  } else {
    await ensureFolder(supabase, userId)
  }

  const filename = sanitizeSkillFilename(opts.filename)
  if (!isAllowedSkillFilename(filename)) {
    return fail('Only text skill files are allowed (.md, .txt, .json, .yml, .yaml).')
  }
  if (opts.body.size > MAX_SKILL_BYTES) {
    return fail('Skill file too large (max 512 KB).')
  }

  const skillName = opts.skillName.trim()
  if (!skillName) {
    return fail('Skill name is required.')
  }

  const prefix = opts.shared ? 'shared' : userId
  const skillUrl = `${prefix}/${filename}`

  if (await urlTaken(supabase, skillUrl)) {
    return fail('A skill file with this name already exists. Choose a different file name.')
  }
  if (await nameTaken(supabase, skillName, opts.shared, userId)) {
    return fail('A skill with this name already exists in this library. Choose a different name.')
  }

  const { error: uploadError } = await supabase.storage
    .from('agent-skills')
    .upload(skillUrl, opts.body, {
      upsert: false,
      contentType: opts.contentType,
    })

  if (uploadError) {
    if (isStorageExistsError(uploadError)) {
      return fail('A skill file with this name already exists. Choose a different file name.')
    }
    return fail(uploadError.message)
  }

  const { data, error: insertError } = await supabase
    .from('agent_skills')
    .insert({
      user_id: opts.shared ? null : userId,
      skill_name: skillName,
      skill_description: opts.skillDescription,
      skill_url: skillUrl,
      source: opts.source,
      source_url: opts.sourceUrl ?? null,
    })
    .select()
    .single()

  if (insertError) {
    await supabase.storage.from('agent-skills').remove([skillUrl])
    if (isUniqueViolation(insertError)) {
      return fail(uniqueConflictMessage(insertError))
    }
    return fail(insertError.message)
  }

  revalidatePath('/agent-skills')
  return ok('Skill saved.', data as AgentSkillRow)
}

function metadataFromContent(
  content: string,
  filename: string,
  explicitName?: string | null,
  explicitDescription?: string | null
) {
  return resolveSkillMetadata({
    content,
    explicitName,
    explicitDescription,
    fallbackName: skillFilenameStem(filename),
  })
}

export async function uploadAgentSkill(formData: FormData): Promise<ActionResult<AgentSkillRow>> {
  return uploadSkillFromForm(formData, false)
}

export async function uploadSharedAgentSkill(
  formData: FormData
): Promise<ActionResult<AgentSkillRow>> {
  return uploadSkillFromForm(formData, true)
}

async function uploadSkillFromForm(
  formData: FormData,
  shared: boolean
): Promise<ActionResult<AgentSkillRow>> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choose a skill file to upload.')
  }
  const filename = sanitizeSkillFilename(file.name)
  if (!ALLOWED_SKILL_EXT.test(filename)) {
    return fail('Only text skill files are allowed (.md, .txt, .json, .yml, .yaml).')
  }
  if (file.size > MAX_SKILL_BYTES) {
    return fail('Skill file too large (max 512 KB).')
  }

  const content = await file.text()
  const { skillName, skillDescription } = metadataFromContent(
    content,
    filename,
    String(formData.get('skill_name') ?? ''),
    String(formData.get('skill_description') ?? '')
  )

  return writeSkill({
    shared,
    filename,
    body: new Blob([content], { type: file.type || 'text/markdown' }),
    contentType: file.type || 'text/markdown',
    skillName,
    skillDescription,
    source: 'upload',
  })
}

export async function importAgentSkillFromGithub(input: {
  url: string
  skill_name?: string
  skill_description?: string
}): Promise<ActionResult<AgentSkillRow>> {
  return importSkillFromGithub(input, false)
}

export async function importSharedAgentSkillFromGithub(input: {
  url: string
  skill_name?: string
  skill_description?: string
}): Promise<ActionResult<AgentSkillRow>> {
  return importSkillFromGithub(input, true)
}

async function importSkillFromGithub(
  input: { url: string; skill_name?: string; skill_description?: string },
  shared: boolean
): Promise<ActionResult<AgentSkillRow>> {
  const url = input.url?.trim()
  if (!url) return fail('Paste a GitHub file URL.')

  let fetched: { filename: string; content: string }
  try {
    fetched = await fetchGitHubSkill(url)
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'GitHub import failed.')
  }

  const { skillName, skillDescription } = metadataFromContent(
    fetched.content,
    fetched.filename,
    input.skill_name,
    input.skill_description
  )

  return writeSkill({
    shared,
    filename: fetched.filename,
    body: new Blob([fetched.content], { type: 'text/markdown' }),
    contentType: 'text/markdown',
    skillName,
    skillDescription,
    source: 'github',
    sourceUrl: url,
  })
}

export async function deleteAgentSkill(id: string): Promise<ActionResult> {
  return deleteSkill(id, false)
}

export async function deleteSharedAgentSkill(id: string): Promise<ActionResult> {
  return deleteSkill(id, true)
}

async function deleteSkill(id: string, shared: boolean): Promise<ActionResult> {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { supabase, userId } = auth

  if (shared && !(await isAdmin(supabase, userId))) {
    return fail('Only admins can manage shared skills.')
  }

  const { data: row, error: lookupError } = await supabase
    .from('agent_skills')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (lookupError) return fail(lookupError.message)
  if (!row) return fail('Skill not found.')

  if (shared) {
    if (row.user_id !== null) return fail('That skill is not in the shared library.')
  } else if (row.user_id !== userId) {
    return fail('You can only delete your own skills.')
  }

  const { error: storageError } = await supabase.storage
    .from('agent-skills')
    .remove([row.skill_url])
  if (storageError) return fail(storageError.message)

  const { error: deleteError } = await supabase.from('agent_skills').delete().eq('id', id)
  if (deleteError) return fail(deleteError.message)

  revalidatePath('/agent-skills')
  return ok('Skill deleted.')
}

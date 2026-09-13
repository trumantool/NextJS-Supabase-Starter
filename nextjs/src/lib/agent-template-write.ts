import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertSharedSkillIds,
  parseDefaults,
  parseDescription,
  parseModelId,
  parseSlug,
  parseStatus,
  parseSystemPrompt,
  parseTemplateName,
  parseTemplateSkillIds,
  publishRecipeError,
  slugifyName,
  STARTER_TEMPLATE,
  type AgentDefaultsV1,
  type TemplateStatus,
} from '@/lib/agent-templates'
import type { Json, TablesInsert, TablesUpdate } from '@/lib/types'

export type TemplateWriteValue = {
  name: string
  slug: string
  description: string | null
  status: TemplateStatus
  system_prompt: string
  skill_ids: string[]
  defaults: AgentDefaultsV1
}

export async function parseTemplateWrite(
  body: Record<string, unknown>,
  opts: { supabase: SupabaseClient; partial?: boolean }
): Promise<{ error?: string; value?: TemplateWriteValue }> {
  const named = body.name !== undefined || !opts.partial ? parseTemplateName(body.name) : {}
  if (named.error) return { error: named.error }

  const slugSource =
    body.slug !== undefined
      ? parseSlug(body.slug)
      : named.name
        ? { slug: slugifyName(named.name) }
        : opts.partial
          ? {}
          : { error: 'Slug is required.' }
  if (slugSource.error) return { error: slugSource.error }

  const description = body.description !== undefined || !opts.partial
    ? parseDescription(body.description)
    : {}
  if (description.error) return { error: description.error }

  const status = body.status !== undefined || !opts.partial ? parseStatus(body.status) : {}
  if (status.error) return { error: status.error }

  const prompt = body.system_prompt !== undefined || !opts.partial
    ? parseSystemPrompt(body.system_prompt)
    : {}
  if (prompt.error) return { error: prompt.error }

  const skills = body.skill_ids !== undefined || !opts.partial
    ? parseTemplateSkillIds(body.skill_ids)
    : {}
  if (skills.error) return { error: skills.error }

  const defaultsInput =
    body.defaults !== undefined
      ? body.defaults
      : body.model_id !== undefined
        ? { model_id: body.model_id }
        : opts.partial
          ? undefined
          : {}
  const defaults =
    defaultsInput !== undefined || !opts.partial ? parseDefaults(defaultsInput) : {}
  if (defaults.error) return { error: defaults.error }

  if (body.model_id !== undefined) {
    const model = parseModelId(body.model_id)
    if (model.error || !model.model_id) return { error: model.error || 'Invalid model_id.' }
    if (defaults.defaults) defaults.defaults.model_id = model.model_id
  }

  if (skills.ids) {
    const visible = await assertSharedSkillIds(opts.supabase, skills.ids)
    if (visible) return { error: visible }
  }

  if (!opts.partial) {
    const publishError =
      status.status === 'published'
        ? publishRecipeError({
            name: named.name || '',
            slug: slugSource.slug || '',
            system_prompt: prompt.system_prompt || '',
            skill_ids: skills.ids || [],
          })
        : null
    if (publishError) return { error: publishError }
  }

  return {
    value: {
      name: named.name || '',
      slug: slugSource.slug || '',
      description: description.description ?? null,
      status: status.status || 'draft',
      system_prompt: prompt.system_prompt || '',
      skill_ids: skills.ids || [],
      defaults: defaults.defaults || { model_id: parseModelId(undefined).model_id },
    },
  }
}

export function templateInsertPayload(
  value: TemplateWriteValue,
  createdBy: string
): TablesInsert<'agent_templates'> {
  return {
    name: value.name,
    slug: value.slug,
    description: value.description,
    status: value.status,
    system_prompt: value.system_prompt,
    skill_ids: value.skill_ids,
    required_toolkits: [],
    mcp_config: {},
    memory_config: {},
    defaults: value.defaults as Json,
    created_by: createdBy,
  }
}

export function templatePatchPayload(value: Partial<TemplateWriteValue>): TablesUpdate<'agent_templates'> {
  const patch: TablesUpdate<'agent_templates'> = {}
  if (value.name !== undefined) patch.name = value.name
  if (value.slug !== undefined) patch.slug = value.slug
  if (value.description !== undefined) patch.description = value.description
  if (value.status !== undefined) patch.status = value.status
  if (value.system_prompt !== undefined) patch.system_prompt = value.system_prompt
  if (value.skill_ids !== undefined) patch.skill_ids = value.skill_ids
  if (value.defaults !== undefined) patch.defaults = value.defaults as Json
  return patch
}

export function starterTemplateWrite(): TemplateWriteValue {
  return {
    name: STARTER_TEMPLATE.name,
    slug: STARTER_TEMPLATE.slug,
    description: STARTER_TEMPLATE.description,
    status: 'published',
    system_prompt: STARTER_TEMPLATE.system_prompt,
    skill_ids: [],
    defaults: { model_id: parseModelId(undefined).model_id! },
  }
}

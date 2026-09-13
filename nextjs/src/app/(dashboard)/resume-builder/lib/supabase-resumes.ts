// Resume Builder — Supabase CRUD helpers.
// Reuses the existing server client from @/lib/supabase/server.
// NOTE: The repo's Database generic does not fully resolve table types, so we
// follow the existing codebase convention of casting queries with `as any`.

import { createSSRClient } from '@/lib/supabase/server'
import type { ResumeInsert, ResumeMeta, ResumeUpdate } from './types'

/** List the current user's resumes, newest first. */
export async function listResumes(): Promise<ResumeMeta[]> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('resumes').select('*').order('updated_at', { ascending: false }) as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as ResumeMeta[]
}

/** Get a single resume by id (RLS scopes to owner). */
export async function getResume(id: string): Promise<ResumeMeta | null> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('resumes').select('*').eq('id', id).maybeSingle() as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data as ResumeMeta) ?? null
}

/** Create a resume. */
export async function createResume(input: ResumeInsert): Promise<ResumeMeta> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('resumes').insert(input).select().single() as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as ResumeMeta
}

/** Update a resume (owner only via RLS). */
export async function updateResume(id: string, input: ResumeUpdate): Promise<ResumeMeta> {
  const supabase = await createSSRClient()
  const query = supabase
    .from('resumes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as ResumeMeta
}

/** Delete a resume (owner only via RLS). */
export async function deleteResume(id: string): Promise<void> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('resumes').delete().eq('id', id) as any
  const { error } = await query
  if (error) throw new Error(error.message)
}

/** Read the admin-chosen OpenRouter model from app_settings. */
export async function getOpenRouterModel(): Promise<string> {
  const supabase = await createSSRClient()
  const query = supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'openrouter_model')
    .maybeSingle() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  const value = data?.value
  return typeof value === 'string' ? value : 'poolside/laguna-s-2.1:free'
}

/** Persist the admin-chosen OpenRouter model. */
export async function setOpenRouterModel(model: string): Promise<void> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('app_settings').upsert({ key: 'openrouter_model', value: model }) as any
  const { error } = await query
  if (error) throw new Error(error.message)
}

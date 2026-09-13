// Documents — Supabase CRUD helpers for the `documents` table.
// Reuses the existing server client from @/lib/supabase/server.
// NOTE: The repo's Database generic does not fully resolve table types, so we
// follow the existing codebase convention of casting queries with `as any`.

import { createSSRClient } from '@/lib/supabase/server'
import type { DocumentInsert, DocumentMeta, DocumentUpdate } from './types'

/** List the current user's documents, newest first. */
export async function listDocuments(): Promise<DocumentMeta[]> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('documents').select('*').order('updated_at', { ascending: false }) as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as DocumentMeta[]
}

/** Get a single document by id (RLS scopes to owner). */
export async function getDocument(id: string): Promise<DocumentMeta | null> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('documents').select('*').eq('id', id).maybeSingle() as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data as DocumentMeta) ?? null
}

/** Create a document. */
export async function createDocument(input: DocumentInsert): Promise<DocumentMeta> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('documents').insert(input).select().single() as any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as DocumentMeta
}

/** Update a document (owner only via RLS). */
export async function updateDocument(id: string, input: DocumentUpdate): Promise<DocumentMeta> {
  const supabase = await createSSRClient()
  const query = supabase
    .from('documents')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as DocumentMeta
}

/** Delete a document (owner only via RLS). */
export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createSSRClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('documents').delete().eq('id', id) as any
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

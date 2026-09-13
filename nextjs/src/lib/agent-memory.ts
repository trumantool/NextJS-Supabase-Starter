import type { SupabaseClient } from '@supabase/supabase-js'

export const AGENT_MEMORY_BUCKET = 'agent-memory'

/** `{userId}/{agentId}/` — must match agent-memory storage RLS. */
export function agentMemoryPrefix(userId: string, agentId: string): string {
  return `${userId}/${agentId}/`
}

export function resolvedMemoryPrefix(userId: string, agentId: string): string {
  return `${AGENT_MEMORY_BUCKET}/${userId}/${agentId}/`
}

export function defaultMemoryConfig(userId: string, agentId: string) {
  return {
    version: 1 as const,
    enabled: false,
    vault_kind: 'markdown_files' as const,
    seed: [] as Array<{ path: string; content: string }>,
    resolved_prefix: resolvedMemoryPrefix(userId, agentId),
    seed_status: 'skipped' as const,
  }
}

/** Create the per-agent folder marker so Phase 5 chat can write notes later. */
export async function ensureAgentMemoryFolder(opts: {
  supabase: SupabaseClient
  userId: string
  agentId: string
}): Promise<string> {
  const prefix = agentMemoryPrefix(opts.userId, opts.agentId)
  await opts.supabase.storage
    .from(AGENT_MEMORY_BUCKET)
    .upload(`${opts.userId}/`, new Blob([]), { upsert: true })
  await opts.supabase.storage
    .from(AGENT_MEMORY_BUCKET)
    .upload(prefix, new Blob([]), { upsert: true })
  return resolvedMemoryPrefix(opts.userId, opts.agentId)
}

export async function deleteAgentMemoryPrefix(opts: {
  supabase: SupabaseClient
  userId: string
  agentId: string
}): Promise<void> {
  const folder = `${opts.userId}/${opts.agentId}`
  const paths = await listMemoryObjects(opts.supabase, folder)
  paths.push(`${folder}/`)
  if (paths.length === 0) return
  const { error } = await opts.supabase.storage.from(AGENT_MEMORY_BUCKET).remove(paths)
  if (error) {
    console.error('deleteAgentMemoryPrefix:', error)
  }
}

async function listMemoryObjects(
  supabase: SupabaseClient,
  folder: string
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(AGENT_MEMORY_BUCKET).list(folder)
  if (error || !data) {
    if (error) console.error('listMemoryObjects:', error)
    return []
  }
  const paths: string[] = []
  for (const item of data) {
    const path = `${folder}/${item.name}`
    if (!item.id) {
      const nested = await listMemoryObjects(supabase, path)
      paths.push(...nested)
      paths.push(`${path}/`)
    } else {
      paths.push(path)
    }
  }
  return paths
}

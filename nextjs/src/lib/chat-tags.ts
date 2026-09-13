import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from '@/lib/ids'
import type { Database } from '@/lib/types'

export type TagRef = {
  id: string
  name: string
  color: string | null
}

type Client = SupabaseClient<Database>

export async function fetchUserTagCatalog(
  supabase: Client,
  userId: string
): Promise<TagRef[]> {
  const { data, error } = await supabase
    .from('session_tags')
    .select('id, name, color')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    console.error('fetchUserTagCatalog:', error)
    return []
  }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
  }))
}

export async function fetchTagsByChatIds(
  supabase: Client,
  chatIds: string[]
): Promise<Map<string, TagRef[]>> {
  const byChat = new Map<string, TagRef[]>()
  if (chatIds.length === 0) return byChat

  const { data: links, error } = await supabase
    .from('chat_tags')
    .select('chat_id, tag_id')
    .in('chat_id', chatIds)

  if (error) {
    console.error('fetchTagsByChatIds:', error)
    return byChat
  }

  const tagIds = Array.from(new Set((links || []).map((row) => row.tag_id)))
  if (tagIds.length === 0) return byChat

  const { data: tags, error: tagsError } = await supabase
    .from('session_tags')
    .select('id, name, color')
    .in('id', tagIds)

  if (tagsError) {
    console.error('fetchTagsByChatIds tags:', tagsError)
    return byChat
  }

  const tagById = new Map((tags || []).map((tag) => [tag.id, tag]))
  for (const row of links || []) {
    const tag = tagById.get(row.tag_id)
    if (!tag) continue
    const list = byChat.get(row.chat_id) ?? []
    list.push({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })
    byChat.set(row.chat_id, list)
  }
  return byChat
}

export async function replaceChatTags(
  supabase: Client,
  opts: { chatId: string; userId: string; tagIds: string[] }
): Promise<string | null> {
  const unique = Array.from(
    new Set(opts.tagIds.filter((id) => isUuid(id)))
  )

  if (unique.length > 0) {
    const { data: owned, error: ownedError } = await supabase
      .from('session_tags')
      .select('id')
      .eq('user_id', opts.userId)
      .in('id', unique)

    if (ownedError) {
      console.error('replaceChatTags owned:', ownedError)
      return 'Failed to validate tags.'
    }
    if ((owned || []).length !== unique.length) {
      return 'One or more tags are missing or not yours.'
    }
  }

  const { error: deleteError } = await supabase
    .from('chat_tags')
    .delete()
    .eq('chat_id', opts.chatId)

  if (deleteError) {
    console.error('replaceChatTags delete:', deleteError)
    return 'Failed to update tags.'
  }

  if (unique.length === 0) return null

  const { error: insertError } = await supabase.from('chat_tags').insert(
    unique.map((tag_id) => ({
      chat_id: opts.chatId,
      tag_id,
    }))
  )

  if (insertError) {
    console.error('replaceChatTags insert:', insertError)
    return 'Failed to update tags.'
  }
  return null
}

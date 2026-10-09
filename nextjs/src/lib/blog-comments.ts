import { createSSRClient } from '@/lib/supabase/server'

export type VisibleComment = {
  id: string
  body: string
  created_at: string
}

export async function listVisibleComments(postId: string): Promise<VisibleComment[]> {
  const supabase = await createSSRClient()
  const { data, error } = await supabase
    .from('blog_comments')
    .select('id, body, created_at')
    .eq('post_id', postId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

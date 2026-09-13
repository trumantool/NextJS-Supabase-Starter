'use server'

import { revalidatePath } from 'next/cache'
import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type TextAssessment = Tables<'text_assessments'>

/**
 * Fetches all text assessments belonging to the authenticated user.
 * Backed by the RLS "Users can view own text assessments" policy.
 */
export async function getMyAssessments(): Promise<TextAssessment[]> {
  const supabase = await createSSRClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('text_assessments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch assessments: ${error.message}`)
  }

  return (data ?? []) as TextAssessment[]
}

/**
 * Renames an assessment owned by the authenticated user.
 * Backed by the RLS "Users can update own text assessments" policy.
 */
export async function renameAssessment(
  assessmentId: string,
  newName: string
): Promise<void> {
  const supabase = await createSSRClient()

  const trimmed = newName.trim()
  if (!trimmed) {
    throw new Error('Assessment name cannot be empty')
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('text_assessments')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Failed to rename assessment: ${error.message}`)
  }

  revalidatePath('/my-assessments')
}

/**
 * Deletes an assessment (and, via ON DELETE CASCADE, its answers) owned by
 * the authenticated user. Backed by the RLS "Users can delete own text
 * assessments" policy.
 */
export async function deleteAssessment(assessmentId: string): Promise<void> {
  const supabase = await createSSRClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('text_assessments')
    .delete()
    .eq('id', assessmentId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Failed to delete assessment: ${error.message}`)
  }

  revalidatePath('/my-assessments')
}

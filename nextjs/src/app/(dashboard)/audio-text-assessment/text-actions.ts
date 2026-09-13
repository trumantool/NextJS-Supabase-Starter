'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type TextAssessment = Tables<'text_assessments'>
type TextAssessmentAnswer = Tables<'text_assessment_answers'>

interface CreateTextAssessmentInput {
  name: string
}

interface SaveAnswerInput {
  assessmentId: string
  questionNumber: number
  questionText: string
  sectionTitle: string
  sectionIndex: number
  answerText: string
}

/**
 * Creates a new named text assessment session for the authenticated user
 */
export async function createTextAssessment(input: CreateTextAssessmentInput): Promise<TextAssessment> {
  const supabase = await createSSRClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('text_assessments')
    .insert({
      user_id: user.id,
      name: input.name,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create assessment: ${error.message}`)
  }

  return data as TextAssessment
}

/**
 * Saves or updates a single text answer for an assessment (upserts on question_number)
 */
export async function saveTextAssessmentAnswer(input: SaveAnswerInput): Promise<TextAssessmentAnswer> {
  const supabase = await createSSRClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify ownership
  const { data: assessment, error: assessmentError } = await supabase
    .from('text_assessments')
    .select('id, user_id')
    .eq('id', input.assessmentId)
    .single()

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  // Upsert the answer (insert or update if question already exists)
  const { data, error } = await supabase
    .from('text_assessment_answers')
    .upsert(
      {
        assessment_id: input.assessmentId,
        question_number: input.questionNumber,
        question_text: input.questionText,
        section_title: input.sectionTitle,
        section_index: input.sectionIndex,
        answer_text: input.answerText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'assessment_id,question_number' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save answer: ${error.message}`)
  }

  return data as TextAssessmentAnswer
}

/**
 * Fetches all text assessments for the authenticated user
 */
export async function getTextAssessments(): Promise<TextAssessment[]> {
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
 * Fetches all answers for a specific assessment
 */
export async function getTextAssessmentAnswers(assessmentId: string): Promise<TextAssessmentAnswer[]> {
  const supabase = await createSSRClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify ownership
  const { data: assessment, error: assessmentError } = await supabase
    .from('text_assessments')
    .select('id, user_id')
    .eq('id', assessmentId)
    .single()

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  const { data, error } = await supabase
    .from('text_assessment_answers')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('question_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch answers: ${error.message}`)
  }

  return (data ?? []) as TextAssessmentAnswer[]
}

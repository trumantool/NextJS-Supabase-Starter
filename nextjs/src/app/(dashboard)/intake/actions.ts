'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type IntakeAssessment = Tables<'intake_assessments'>
type IntakeResponse = Tables<'intake_responses'>

interface CreateAssessmentInput {
  sectionIndex: number
  sectionTitle: string
}

interface SaveResponseInput {
  questionNumber: number
  questionText: string
  sectionTitle: string
  audioFilePath: string
  durationSeconds?: number
}

/**
 * Creates a new intake assessment session for the authenticated user
 */
export async function createAssessment(input: CreateAssessmentInput): Promise<IntakeAssessment> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Create the assessment
  const query = supabase
    .from('intake_assessments')
    .insert({
      user_id: user.id,
      section_index: input.sectionIndex,
      section_title: input.sectionTitle,
    })

  const { data, error } = await query.select().single()

  if (error) {
    throw new Error(`Failed to create assessment: ${error.message}`)
  }

  return data as IntakeAssessment
}

/**
 * Uploads audio file to Supabase Storage and creates a response record
 */
export async function uploadAudioAndSaveResponse(
  assessmentId: string,
  input: SaveResponseInput
): Promise<IntakeResponse> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify that the assessment belongs to the user
  const { data: assessment, error: assessmentError } = await (supabase
    .from('intake_assessments')
    .select('id, user_id')
    .eq('id', assessmentId)
    .single())

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  // Create the response record
  const responseQuery = supabase
    .from('intake_responses')
    .insert({
      assessment_id: assessmentId,
      question_number: input.questionNumber,
      question_text: input.questionText,
      section_title: input.sectionTitle,
      audio_file_path: input.audioFilePath,
      duration_seconds: input.durationSeconds,
      recorded_at: new Date().toISOString(),
    })

  const { data: response, error: responseError } = await responseQuery.select().single()

  if (responseError) {
    throw new Error(`Failed to save response: ${responseError.message}`)
  }

  return response as IntakeResponse
}

/**
 * Uploads an audio file to Supabase Storage
 */
export async function uploadAudioFile(
  assessmentId: string,
  questionNumber: number,
  audioBlob: Blob
): Promise<string> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify that the assessment belongs to the user
  const uploadCheckQuery = supabase
    .from('intake_assessments')
    .select('id, user_id')
    .eq('id', assessmentId)
    .single()

  const { data: assessment, error: assessmentError } = await uploadCheckQuery

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  // Create a unique file path
  const fileName = `assessments/${user.id}/${assessmentId}/q${questionNumber}-${Date.now()}.webm`

  // Upload the file
  const { data, error } = await supabase.storage
    .from('intake-audio')
    .upload(fileName, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`)
  }

  return data.path
}

/**
 * Gets all assessments for the authenticated user
 */
export async function getAssessments(): Promise<IntakeAssessment[]> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const assessmentsQuery = supabase
    .from('intake_assessments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data, error } = await assessmentsQuery

  if (error) {
    throw new Error(`Failed to fetch assessments: ${error.message}`)
  }

  return (data || []) as IntakeAssessment[]
}

/**
 * Gets all responses for a specific assessment
 */
export async function getAssessmentResponses(
  assessmentId: string
): Promise<IntakeResponse[]> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify that the assessment belongs to the user
  const responseCheckQuery = supabase
    .from('intake_assessments')
    .select('id, user_id')
    .eq('id', assessmentId)
    .single()

  const { data: assessment, error: assessmentError } = await responseCheckQuery

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  const responsesQuery = supabase
    .from('intake_responses')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('question_number', { ascending: true })

  const { data, error } = await responsesQuery

  if (error) {
    throw new Error(`Failed to fetch responses: ${error.message}`)
  }

  return (data || []) as IntakeResponse[]
}

/**
 * Gets a public download URL for an audio file
 */
export async function getAudioDownloadUrl(audioFilePath: string): Promise<string> {
  const supabase = await createSSRClient()

  const { data } = supabase.storage
    .from('intake-audio')
    .getPublicUrl(audioFilePath)

  return data.publicUrl
}

'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type AudioTextAssessment = Tables<'audio_text_assessments'>
type AudioTextResponse = Tables<'audio_text_responses'>

interface CreateAssessmentInput {
  sectionIndex: number
  sectionTitle: string
}

interface SaveResponseInput {
  assessmentId: string
  questionNumber: number
  questionText: string
  sectionTitle: string
  audioFilePath: string
  transcriptText?: string
  durationSeconds?: number
}

/**
 * Creates a new audio-text assessment session for the authenticated user
 */
export async function createAssessment(input: CreateAssessmentInput): Promise<AudioTextAssessment> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Create the assessment
  const query = supabase
    .from('audio_text_assessments')
    .insert({
      user_id: user.id,
      section_index: input.sectionIndex,
      section_title: input.sectionTitle,
    })

  const { data, error } = await query.select().single()

  if (error) {
    throw new Error(`Failed to create assessment: ${error.message}`)
  }

  return data as AudioTextAssessment
}

/**
 * Uploads audio file to Supabase Storage and creates a response record
 */
export async function uploadAudioAndSaveResponse(
  assessmentId: string,
  input: SaveResponseInput
): Promise<AudioTextResponse> {
  const supabase = await createSSRClient()

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Verify that the assessment belongs to the user
  const { data: assessment, error: assessmentError } = await (supabase
    .from('audio_text_assessments')
    .select('id, user_id')
    .eq('id', assessmentId)
    .single())

  if (assessmentError || !assessment || assessment.user_id !== user.id) {
    throw new Error('Assessment not found or not authorized')
  }

  // Create the response record
  const responseQuery = supabase
    .from('audio_text_responses')
    .insert({
      assessment_id: assessmentId,
      question_number: input.questionNumber,
      question_text: input.questionText,
      section_title: input.sectionTitle,
      transcript_text: input.transcriptText,
      audio_file_path: input.audioFilePath,
      duration_seconds: input.durationSeconds,
      recorded_at: new Date().toISOString(),
    })

  const { data: response, error: responseError } = await responseQuery.select().single()

  if (responseError) {
    throw new Error(`Failed to save response: ${responseError.message}`)
  }

  return response as AudioTextResponse
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
    .from('audio_text_assessments')
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
    .from('audio-text-audio')
    .upload(fileName, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`)
  }

  return data.path
}

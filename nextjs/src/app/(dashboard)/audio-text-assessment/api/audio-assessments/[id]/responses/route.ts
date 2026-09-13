// Audio Assessment Responses API — POST upload a recording and save its
// response record for an audio-text assessment.
// Follows the same API-route pattern as text-assessments (resume-builder
// style) to avoid "Invalid Server Actions request" from client components.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

/** POST /api/audio-assessments/[id]/responses — upload audio + save response */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership of the assessment
    const assessQuery = supabase
      .from('audio_text_assessments')
      .select('id, user_id')
      .eq('id', id)
      .single()

    const { data: assessment, error: assessError } = await assessQuery
    if (assessError || !assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Parse multipart form data: audio file + response fields
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const questionNumber = Number(formData.get('questionNumber') ?? 0)
    const questionText = String(formData.get('questionText') ?? '')
    const sectionTitle = String(formData.get('sectionTitle') ?? '')
    const transcriptText = (formData.get('transcriptText') as string | null) ?? null
    const durationSeconds = formData.get('durationSeconds')
      ? Number(formData.get('durationSeconds'))
      : null

    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    // Upload the audio file to storage
    const fileName = `assessments/${user.id}/${id}/q${questionNumber}-${Date.now()}.webm`

    const uploadQuery = supabase.storage
      .from('audio-text-audio')
      .upload(fileName, audioFile, {
        contentType: audioFile.type || 'audio/webm',
        upsert: false,
      })

    const { data: uploadData, error: uploadError } = await uploadQuery
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Save the response record
    const responseQuery = supabase
      .from('audio_text_responses')
      .insert({
        assessment_id: id,
        question_number: questionNumber,
        question_text: questionText,
        section_title: sectionTitle,
        transcript_text: transcriptText,
        audio_file_path: uploadData.path,
        duration_seconds: durationSeconds,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single()

    const { data, error } = await responseQuery
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ response: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save response' },
      { status: 500 }
    )
  }
}

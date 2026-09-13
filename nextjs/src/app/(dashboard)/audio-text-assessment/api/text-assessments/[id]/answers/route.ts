// Text Assessment Answers API — GET list / PUT upsert answers for an assessment.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

/** GET /api/text-assessments/[id]/answers — list all answers for an assessment */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const assessQuery = supabase
      .from('text_assessments')
      .select('id, user_id')
      .eq('id', id)
      .single()

    const { data: assessment, error: assessError } = await assessQuery
    if (assessError || !assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const answerQuery = supabase
      .from('text_assessment_answers')
      .select('*')
      .eq('assessment_id', id)
      .order('question_number', { ascending: true })

    const { data, error } = await answerQuery
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ answers: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch answers' },
      { status: 500 }
    )
  }
}

/** PUT /api/text-assessments/[id]/answers — upsert a single answer */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const assessQuery = supabase
      .from('text_assessments')
      .select('id, user_id')
      .eq('id', id)
      .single()

    const { data: assessment, error: assessError } = await assessQuery
    if (assessError || !assessment || assessment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      questionNumber: number
      questionText: string
      sectionTitle: string
      sectionIndex: number
      answerText: string
    }

    const answerQuery = supabase
      .from('text_assessment_answers')
      .upsert(
        {
          assessment_id: id,
          question_number: body.questionNumber,
          question_text: body.questionText,
          section_title: body.sectionTitle,
          section_index: body.sectionIndex,
          answer_text: body.answerText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'assessment_id,question_number' }
      )
      .select()
      .single()

    const { data, error } = await answerQuery
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ answer: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save answer' },
      { status: 500 }
    )
  }
}

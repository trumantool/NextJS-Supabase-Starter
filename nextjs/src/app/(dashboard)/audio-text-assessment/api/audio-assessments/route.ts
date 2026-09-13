// Audio Assessment API — POST create audio-text assessments.
// Mirrors the text-assessments API route pattern (resume-builder style) to
// avoid calling server actions directly from client components.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'

/** POST /api/audio-assessments — create a new audio-text assessment */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      sectionIndex?: number
      sectionTitle?: string
    }

    const query = supabase
      .from('audio_text_assessments')
      .insert({
        user_id: user.id,
        section_index: body.sectionIndex ?? 0,
        section_title: body.sectionTitle ?? 'Audio-Text Assessment',
      })
      .select()
      .single()

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assessment: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create assessment' },
      { status: 500 }
    )
  }
}

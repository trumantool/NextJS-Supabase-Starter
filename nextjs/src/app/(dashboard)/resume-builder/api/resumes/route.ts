// Resume Builder — GET list / POST create resumes.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createResume, listResumes } from '../../lib/supabase-resumes'
import type { ResumeInsert } from '../../lib/types'

export async function GET() {
  try {
    const resumes = await listResumes()
    return NextResponse.json({ resumes })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list resumes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<ResumeInsert>
    const resume = await createResume({
      user_id: user.id,
      title: body.title ?? 'Untitled Resume',
      template: body.template ?? 'classic',
      doc_json: body.doc_json ?? {},
      model: body.model,
    })

    return NextResponse.json({ resume }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create resume' },
      { status: 500 }
    )
  }
}
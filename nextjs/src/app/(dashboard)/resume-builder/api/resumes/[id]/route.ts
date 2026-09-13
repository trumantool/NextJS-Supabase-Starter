// Resume Builder — GET one / PATCH / DELETE a resume.
import { NextResponse, type NextRequest } from 'next/server'
import { deleteResume, getResume, updateResume } from '../../../lib/supabase-resumes'
import type { ResumeUpdate } from '../../../lib/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const resume = await getResume(id)
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ resume })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load resume' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = (await request.json()) as ResumeUpdate
    const resume = await updateResume(id, body)
    return NextResponse.json({ resume })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update resume' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await deleteResume(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete resume' },
      { status: 500 }
    )
  }
}
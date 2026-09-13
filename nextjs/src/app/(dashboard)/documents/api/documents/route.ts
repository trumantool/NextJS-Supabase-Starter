// Documents — GET list / POST create documents.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { createDocument, listDocuments } from '../../lib/supabase-documents'
import type { DocumentInsert } from '../../lib/types'

export async function GET() {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documents = await listDocuments()
    return NextResponse.json({ documents })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list documents' },
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

    const body = (await request.json()) as Partial<DocumentInsert>
    const document = await createDocument({
      user_id: user.id,
      title: body.title ?? 'Untitled document',
      template: body.template ?? 'blank',
      doc_json: body.doc_json ?? {},
      model: body.model,
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create document' },
      { status: 500 }
    )
  }
}

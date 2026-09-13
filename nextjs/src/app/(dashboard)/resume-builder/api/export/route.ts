// Resume Builder — POST: ProseMirror JSON -> .docx download.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { buildDocx } from '../../lib/docx-export'
import type { ResumeDoc } from '../../lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { doc?: ResumeDoc; title?: string }
    const doc = body.doc ?? { type: 'doc', content: [] }
    const title = body.title ?? 'resume'

    const bytes = await buildDocx(doc)
    const safeTitle = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'resume'

    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
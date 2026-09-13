// Resume Builder — POST: stream OpenRouter completions as SSE.
import { NextResponse, type NextRequest } from 'next/server'
import { createSSRClient } from '@/lib/supabase/server'
import { getOpenRouterModel } from '../../lib/supabase-resumes'
import { streamChatCompletion } from '../../lib/openrouter'
import type { AiRequest, ResumeDoc } from '../../lib/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as AiRequest
    const model = body.model || (await getOpenRouterModel())

    // Build a compact representation of the current doc for context.
    const docText = summarizeDoc(body.doc)

    const system = [
      'You are an expert resume writer. You help users write, improve, and tailor resume content.',
      'Respond with plain text only. Use simple formatting: headings on their own line, bullet points starting with "-".',
      'Be concise, professional, and specific. Do not invent facts the user did not provide.',
    ].join(' ')

    const userMsg = [
      docText ? `Current resume content:\n${docText}\n` : '',
      `Task: ${body.prompt}`,
    ]
      .filter(Boolean)
      .join('\n')

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
        try {
          await streamChatCompletion({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userMsg },
            ],
            onChunk: (delta) => send(JSON.stringify({ delta })),
          })
          send(JSON.stringify({ done: true }))
        } catch (err) {
          send(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'AI request failed',
            })
          )
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    )
  }
}

/** Flatten a ProseMirror doc into readable text for the model. */
function summarizeDoc(doc?: ResumeDoc): string {
  if (!doc?.content) return ''
  const lines: string[] = []
  const walk = (nodes: ResumeDoc['content']) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        lines.push(node.text ?? '')
      } else if (node.content) {
        walk(node.content)
      }
    }
  }
  walk(doc.content)
  return lines.join(' ').slice(0, 8000)
}
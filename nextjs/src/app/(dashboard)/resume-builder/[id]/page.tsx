// Resume Builder — editor view (server: load resume, pass to client editor).
import { notFound } from 'next/navigation'
import { getResume } from '../lib/supabase-resumes'
import { ResumeEditorClient } from '../components/ResumeEditorClient'
import type { ResumeDoc } from '../lib/types'

export const dynamic = 'force-dynamic'

export default async function ResumeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const resume = await getResume(id)
  if (!resume) notFound()

  const doc = (resume.doc_json ?? { type: 'doc', content: [] }) as unknown as ResumeDoc

  return (
    <ResumeEditorClient
      resumeId={resume.id}
      initialTitle={resume.title}
      initialDoc={doc}
    />
  )
}
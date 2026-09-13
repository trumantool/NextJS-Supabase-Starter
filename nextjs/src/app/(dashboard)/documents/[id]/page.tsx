// Documents — editor view (server: load document, pass to client editor).
import { notFound } from 'next/navigation'
import { getDocument } from '../lib/supabase-documents'
import { DocumentEditorClient } from '../components/DocumentEditorClient'
import type { TipTapDoc } from '../lib/types'

export const dynamic = 'force-dynamic'

export default async function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const document = await getDocument(id)
  if (!document) notFound()

  const doc = (document.doc_json ?? { type: 'doc', content: [] }) as unknown as TipTapDoc

  return (
    <DocumentEditorClient
      documentId={document.id}
      initialTitle={document.title}
      initialDoc={doc}
    />
  )
}

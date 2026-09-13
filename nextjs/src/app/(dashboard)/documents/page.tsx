// Documents — list the signed-in user's documents + "New".
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { listDocuments } from './lib/supabase-documents'
import { DeleteDocumentButton } from './components/DeleteDocumentButton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Documents',
}

export default async function DocumentsPage() {
  const documents = await listDocuments()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">
            Create, edit, and export documents with optional AI assistance.
          </p>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New document
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <FileText className="h-10 w-10 mx-auto text-gray-300" />
          <p className="mt-3 text-gray-500">No documents yet.</p>
          <Link
            href="/documents/new"
            className="mt-3 inline-block text-blue-600 font-medium hover:underline"
          >
            Create your first document
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((document) => (
            <div
              key={document.id}
              className="group relative rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <Link
                href={`/documents/${document.id}`}
                className="block"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900 truncate">
                    {document.title}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {document.template} · Updated{' '}
                  {new Date(document.updated_at).toLocaleDateString()}
                </div>
              </Link>
              <DeleteDocumentButton id={document.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

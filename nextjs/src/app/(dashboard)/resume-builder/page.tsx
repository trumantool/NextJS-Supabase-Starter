// Resume Builder — dashboard: list user's resumes + "New".
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { listResumes } from './lib/supabase-resumes'
import { DeleteResumeButton } from './components/DeleteResumeButton'

export const dynamic = 'force-dynamic'

export default async function ResumeBuilderPage() {
  const resumes = await listResumes()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resume Builder</h1>
          <p className="text-sm text-gray-500">
            Create, edit, and export professional resumes.
          </p>
        </div>
        <Link
          href="/resume-builder/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
          <FileText className="h-10 w-10 mx-auto text-gray-300" />
          <p className="mt-3 text-gray-500">No resumes yet.</p>
          <Link
            href="/resume-builder/new"
            className="mt-3 inline-block text-blue-600 font-medium hover:underline"
          >
            Create your first resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="group relative rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <Link
                href={`/resume-builder/${resume.id}`}
                className="block"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900 truncate">
                    {resume.title}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {resume.template} · Updated{' '}
                  {new Date(resume.updated_at).toLocaleDateString()}
                </div>
              </Link>
              <DeleteResumeButton id={resume.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
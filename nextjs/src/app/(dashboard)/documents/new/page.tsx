// Documents — template picker page.
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TemplatePicker } from '../components/TemplatePicker'

export const metadata = {
  title: 'New document',
}

export default function NewDocumentPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        href="/documents"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New document</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a template to get started.</p>
      <TemplatePicker />
    </div>
  )
}

import React from 'react'
import { getTermsSettings } from '@/lib/actions/terms'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { TermsOfServiceView } from '@/components/TermsOfServiceView'
import { FileText } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service',
  description: 'The rules and guidelines for using our service.',
}

export default async function TermsPage() {
  const [settings, isAdmin] = await Promise.all([
    getTermsSettings(),
    isCurrentUserAdmin(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          The rules and guidelines for using our service.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-10">
          <TermsOfServiceView settings={settings} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}
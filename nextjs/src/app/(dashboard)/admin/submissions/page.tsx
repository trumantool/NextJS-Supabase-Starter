import React from 'react'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin, getContactSubmissions } from '@/app/(dashboard)/admin/actions'
import { SubmissionsTable } from '@/components/SubmissionsTable'
import { Inbox } from 'lucide-react'

export const metadata = {
  title: 'Contact Submissions',
  description: 'Manage contact form submissions.',
}

export default async function SubmissionsPage() {
  // Only admins can view this page
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch all submissions (admin-only server action)
  const { submissions, total } = await getContactSubmissions()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Contact Submissions</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Messages submitted through the contact form ({total} total).
        </p>

        <SubmissionsTable initialSubmissions={submissions} />
      </div>
    </div>
  )
}
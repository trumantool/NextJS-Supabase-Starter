import React from 'react'
import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { AdminSettingsTabs } from '@/components/AdminSettingsTabs'
import { Settings } from 'lucide-react'

export const metadata = {
  title: 'Admin Settings',
  description: 'Manage site-wide admin settings.',
}

export default async function AdminPage() {
  // Only admins can view this page
  const isAdmin = await isCurrentUserAdmin()
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Manage site-wide configuration options. Changes apply immediately.
        </p>
        <AdminSettingsTabs />
      </div>
    </div>
  )
}
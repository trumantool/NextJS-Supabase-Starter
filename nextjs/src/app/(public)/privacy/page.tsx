import React from 'react'
import { getPrivacySettings } from '@/lib/actions/privacy'
import { isCurrentUserAdmin } from '@/app/(dashboard)/admin/actions'
import { PrivacyPolicyView } from '@/components/PrivacyPolicyView'
import { Shield } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy',
  description: 'Learn how we collect, use, and protect your information.',
}

export default async function PrivacyPage() {
  const [settings, isAdmin] = await Promise.all([
    getPrivacySettings(),
    isCurrentUserAdmin(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          How we collect, use, and protect your information.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-10">
          <PrivacyPolicyView settings={settings} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}
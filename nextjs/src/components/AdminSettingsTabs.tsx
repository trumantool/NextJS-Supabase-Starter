'use client'

import React, { useState } from 'react'
import { AdminSettingsForm } from '@/components/AdminSettingsForm'
import { ModelSettingsForm } from '@/app/(dashboard)/resume-builder/components/ModelSettingsForm'

const TABS = [
  { id: 'site', label: 'Site Settings' },
  { id: 'resume', label: 'Resume Settings' },
] as const

type TabId = (typeof TABS)[number]['id']

export function AdminSettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('site')

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6" aria-label="Admin settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
              className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'site' ? (
        <AdminSettingsForm />
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Resume Settings</h2>
          <p className="text-sm text-gray-500 mb-6">
            Configure the AI model used by the resume builder.
          </p>
          <ModelSettingsForm />
        </div>
      )}
    </div>
  )
}
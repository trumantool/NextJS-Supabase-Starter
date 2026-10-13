'use client'

import React, { useState } from 'react'
import { EditButton } from '@/components/EditButton'
import { LegalIdentityFields } from '@/components/LegalIdentityFields'
import { PrivacyPolicyEditor } from '@/components/PrivacyPolicyEditor'
import { GENERIC_PRIVACY_HTML, mergeLegalSettings, renderLegalDocument } from '@/lib/legal-pages'
import type { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

interface Props {
  settings: AdminSetting[]
  isAdmin?: boolean
}

/**
 * Renders the privacy policy with shortcodes resolved, plus an admin-only
 * Edit button that swaps in the TipTap editor.
 */
export function PrivacyPolicyView({ settings, isAdmin }: Props) {
  const [editing, setEditing] = useState(false)
  const [currentSettings, setCurrentSettings] = useState(settings)

  const privacySetting = currentSettings.find((s) => s.option_name === 'privacy_policy')
  const rawContent = privacySetting?.option_value ?? ''
  const [content, setContent] = useState(rawContent)

  const rendered = renderLegalDocument('privacy', currentSettings, content)

  return (
    <div className="relative">
      {isAdmin ? (
        <LegalIdentityFields
          settings={currentSettings}
          onSaved={(saved) => setCurrentSettings((prev) => mergeLegalSettings(prev, saved))}
        />
      ) : null}
      {editing ? null : (
        <div className="mb-4 flex justify-end">
          <EditButton isAdmin={isAdmin} onClick={() => setEditing(true)} />
        </div>
      )}

      {editing ? (
        <PrivacyPolicyEditor
          initialContent={content.trim() ? content : GENERIC_PRIVACY_HTML}
          onCancel={() => setEditing(false)}
          onSaved={(html) => {
            setContent(html)
            setEditing(false)
          }}
        />
      ) : (
        <div
          className="prose prose-blue max-w-none"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      )}
    </div>
  )
}
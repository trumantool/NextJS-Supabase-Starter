'use client'

import React, { useState } from 'react'
import { EditButton } from '@/components/EditButton'
import { LegalIdentityFields } from '@/components/LegalIdentityFields'
import { TermsOfServiceEditor } from '@/components/TermsOfServiceEditor'
import { GENERIC_TERMS_HTML, mergeLegalSettings, renderLegalDocument } from '@/lib/legal-pages'
import type { Tables } from '@/lib/types'

type AdminSetting = Tables<'admin_settings'>

interface Props {
  settings: AdminSetting[]
  isAdmin?: boolean
}

/**
 * Renders the Terms of Service with shortcodes resolved, plus an admin-only
 * Edit button that swaps in the TipTap editor.
 */
export function TermsOfServiceView({ settings, isAdmin }: Props) {
  const [editing, setEditing] = useState(false)
  const [currentSettings, setCurrentSettings] = useState(settings)

  const termsSetting = currentSettings.find((s) => s.option_name === 'terms_of_service')
  const rawContent = termsSetting?.option_value ?? ''
  const [content, setContent] = useState(rawContent)

  const rendered = renderLegalDocument('terms', currentSettings, content)

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
        <TermsOfServiceEditor
          initialContent={content.trim() ? content : GENERIC_TERMS_HTML}
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
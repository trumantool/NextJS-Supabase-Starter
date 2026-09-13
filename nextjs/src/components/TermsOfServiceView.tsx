'use client'

import React, { useState } from 'react'
import { EditButton } from '@/components/EditButton'
import { TermsOfServiceEditor } from '@/components/TermsOfServiceEditor'
import { resolveShortcodes } from '@/lib/shortcodes'
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

  const termsSetting = settings.find((s) => s.option_name === 'terms_of_service')
  const rawContent = termsSetting?.option_value ?? ''
  const [content, setContent] = useState(rawContent)

  const rendered = resolveShortcodes(content, settings)

  return (
    <div className="relative">
      {/* Edit button in the upper right corner */}
      <div className="absolute top-0 right-0">
        <EditButton isAdmin={isAdmin} onClick={() => setEditing(true)} />
      </div>

      {editing ? (
        <TermsOfServiceEditor
          initialContent={content}
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
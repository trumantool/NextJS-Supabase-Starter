'use client'

import React, { useState } from 'react'
import { EditButton } from '@/components/EditButton'
import { PrivacyPolicyEditor } from '@/components/PrivacyPolicyEditor'
import { resolveShortcodes } from '@/lib/shortcodes'
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

  const privacySetting = settings.find((s) => s.option_name === 'privacy_policy')
  const rawContent = privacySetting?.option_value ?? ''
  const [content, setContent] = useState(rawContent)

  const rendered = resolveShortcodes(content, settings)

  return (
    <div className="relative">
      {/* Edit button in the upper right corner */}
      <div className="absolute top-0 right-0">
        <EditButton isAdmin={isAdmin} onClick={() => setEditing(true)} />
      </div>

      {editing ? (
        <PrivacyPolicyEditor
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
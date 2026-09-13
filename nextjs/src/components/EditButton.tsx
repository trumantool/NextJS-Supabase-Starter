'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface EditButtonProps {
  onClick: () => void
  label?: string
  className?: string
  /**
   * Whether the current user is an admin. When false (or omitted), the button
   * is not rendered. Determine this server-side and pass it down.
   */
  isAdmin?: boolean
}

/**
 * A reusable "Edit" button that is only visible to admin users.
 * Admins are users in the `user_data` table with `user_role = 'admin'`.
 *
 * Pass `isAdmin` (computed server-side) to control visibility:
 *   <EditButton isAdmin={isAdmin} onClick={() => setEditing(true)} />
 */
export function EditButton({ onClick, label = 'Edit', className, isAdmin }: EditButtonProps) {
  if (!isAdmin) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={className}
    >
      <Pencil className="h-4 w-4" />
      {label}
    </Button>
  )
}
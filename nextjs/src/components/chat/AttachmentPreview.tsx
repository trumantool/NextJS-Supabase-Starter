'use client'

import { FileText, X } from 'lucide-react'
import type { ChatAttachment } from '@/lib/chat-messages'

type AttachmentPreviewProps = {
  attachment: ChatAttachment
  onRemove?: () => void
}

export default function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  const isImage = attachment.contentType.startsWith('image/')

  return (
    <div className="relative inline-flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-xs text-gray-700">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.name}
          className="h-8 w-8 rounded object-cover"
        />
      ) : (
        <FileText className="h-4 w-4 text-gray-400" />
      )}
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="max-w-[10rem] truncate hover:underline"
      >
        {attachment.name}
      </a>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-gray-700"
          aria-label={`Remove ${attachment.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}

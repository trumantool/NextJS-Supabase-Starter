'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Send, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import AgentSwitcher from '@/components/chat/AgentSwitcher'
import {
  CHAT_ATTACHMENT_ACCEPT,
  isAllowedChatAttachment,
} from '@/lib/chat-storage'
import type { UserAgent } from '@/lib/types'

type ChatComposerProps = {
  agents: UserAgent[]
  agentId: string | null
  modelId: string
  pendingFiles: File[]
  disabled?: boolean
  generating?: boolean
  onAgentChange: (agentId: string | null) => void
  onModelChange: (modelId: string) => void
  onFilesChange: (files: File[]) => void
  onSubmit: (text: string) => void
  onStop: () => void
}

export default function ChatComposer({
  agents,
  agentId,
  modelId,
  pendingFiles,
  disabled,
  generating,
  onAgentChange,
  onModelChange,
  onFilesChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | File[]) => {
    const next = [...pendingFiles]
    const errors: string[] = []
    for (const file of Array.from(list)) {
      const reason = isAllowedChatAttachment(file)
      if (reason) {
        errors.push(reason)
        continue
      }
      next.push(file)
    }
    onFilesChange(next)
    setFileError(errors[0] || '')
  }

  const submit = () => {
    const value = text.trim()
    if ((!value && pendingFiles.length === 0) || disabled || generating) return
    onSubmit(value)
    setText('')
  }

  return (
    <div className="border-t bg-white p-3 space-y-2">
      {pendingFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-xs text-gray-700"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="max-w-[10rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onFilesChange(pendingFiles.filter((_, i) => i !== index))}
                className="text-gray-400 hover:text-gray-700"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="Message the assistant…"
        disabled={disabled}
        className="min-h-[72px] resize-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <AgentSwitcher
          id="composer-agent-switcher"
          agents={agents}
          value={agentId}
          disabled={generating}
          onChange={onAgentChange}
        />
        <input
          value={modelId}
          onChange={(event) => onModelChange(event.target.value)}
          disabled={generating}
          aria-label="OpenRouter model"
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-xs"
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={CHAT_ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Attach images, CSV, PDF, or text"
          disabled={disabled || generating}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        {generating ? (
          <Button type="button" variant="secondary" onClick={onStop}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={disabled}>
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        )}
      </div>
    </div>
  )
}

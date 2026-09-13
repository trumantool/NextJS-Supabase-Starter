'use client'

import ReactMarkdown from 'react-markdown'
import { attachmentsFromContent, textFromContent, type ChatUiMessage } from '@/lib/chat-messages'
import AttachmentPreview from '@/components/chat/AttachmentPreview'

export default function MessageItem({ message }: { message: ChatUiMessage }) {
  const isUser = message.role === 'user'
  const text = textFromContent(message.content)
  const attachments = attachmentsFromContent(message.content)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-white text-gray-800 border shadow-sm'
        }`}
      >
        {attachments.length > 0 ? (
          <div className={`mb-2 flex flex-wrap gap-2 ${isUser ? '[&_a]:text-white' : ''}`}>
            {attachments.map((file) => (
              <AttachmentPreview key={`${file.storagePath || file.url}-${file.name}`} attachment={file} />
            ))}
          </div>
        ) : null}
        {text ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:bg-gray-50">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

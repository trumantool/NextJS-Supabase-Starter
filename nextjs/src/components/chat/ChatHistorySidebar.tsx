'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { chatPathForAgent } from '@/lib/chat-agent'
import type { TagRef } from '@/lib/chat-tags'
import type { ChatThread } from '@/lib/chat-types'

type ChatHistorySidebarProps = {
  chats: ChatThread[]
  catalog: TagRef[]
  activeChatId?: string | null
  agentId: string | null
  onNewChat: () => void
  onRename: (chatId: string, title: string) => void
  onDelete: (chatId: string) => void
  onSetTags: (chatId: string, tagIds: string[]) => void
  onCreateTag: (name: string) => Promise<TagRef | null>
}

export default function ChatHistorySidebar({
  chats,
  catalog,
  activeChatId,
  agentId,
  onNewChat,
  onRename,
  onDelete,
  onSetTags,
  onCreateTag,
}: ChatHistorySidebarProps) {
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [newTag, setNewTag] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [tagEditId, setTagEditId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return chats.filter((chat) => {
      if (tagFilter && !(chat.tags || []).some((tag) => tag.id === tagFilter)) {
        return false
      }
      if (!needle) return true
      const title = (chat.title || 'New chat').toLowerCase()
      const tagNames = (chat.tags || []).map((tag) => tag.name.toLowerCase()).join(' ')
      return title.includes(needle) || tagNames.includes(needle)
    })
  }, [chats, query, tagFilter])

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-gray-50">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-semibold text-gray-800">Chats</h2>
        <Button size="sm" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="pl-8"
          />
        </div>
        <select
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All tags</option>
          {catalog.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No chats yet. Start one to the right.</p>
        ) : (
          <ul className="p-2 space-y-1">
            {filtered.map((chat) => {
              const href = `${chatPathForAgent(agentId).split('?')[0]}/${chat.id}`
              const active = chat.id === activeChatId
              return (
                <li
                  key={chat.id}
                  className={`rounded-md border ${
                    active ? 'border-primary-200 bg-white' : 'border-transparent hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-1 p-2">
                    <Link href={href} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                        <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{chat.title || 'New chat'}</span>
                      </div>
                      {(chat.tags || []).length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {chat.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-1.5 py-0.5 text-[10px] text-gray-600"
                              style={{ backgroundColor: tag.color || '#e5e7eb' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-gray-700"
                      aria-label="Rename chat"
                      onClick={() => {
                        setEditingId(chat.id)
                        setDraftTitle(chat.title || '')
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-gray-700"
                      aria-label="Tag chat"
                      onClick={() => setTagEditId(tagEditId === chat.id ? null : chat.id)}
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-red-600"
                      aria-label="Delete chat"
                      onClick={() => onDelete(chat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingId === chat.id ? (
                    <div className="flex gap-1 px-2 pb-2">
                      <Input
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          onRename(chat.id, draftTitle)
                          setEditingId(null)
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                  {tagEditId === chat.id ? (
                    <div className="space-y-2 px-2 pb-2">
                      {catalog.map((tag) => {
                        const selected = (chat.tags || []).some((item) => item.id === tag.id)
                        return (
                          <label key={tag.id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const next = selected
                                  ? (chat.tags || []).filter((item) => item.id !== tag.id).map((item) => item.id)
                                  : [...(chat.tags || []).map((item) => item.id), tag.id]
                                onSetTags(chat.id, next)
                              }}
                            />
                            {tag.name}
                          </label>
                        )
                      })}
                      <div className="flex gap-1">
                        <Input
                          value={newTag}
                          onChange={(event) => setNewTag(event.target.value)}
                          placeholder="New tag"
                          className="h-8"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const created = await onCreateTag(newTag)
                            if (created) {
                              onSetTags(chat.id, [...(chat.tags || []).map((item) => item.id), created.id])
                              setNewTag('')
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

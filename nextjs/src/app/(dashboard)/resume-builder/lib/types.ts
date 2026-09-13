// Resume Builder — feature-local types.
// Everything here is scoped to the resume-builder feature and can be deleted
// by removing this folder.

import type { Json } from '@/lib/types'

/** A ProseMirror/TipTap document node (JSON). */
export interface PmNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

/** The full document stored in `resumes.doc_json`. */
export interface ResumeDoc {
  type: 'doc'
  content: PmNode[]
}

/** Row shape for the `resumes` table. */
export interface ResumeMeta {
  id: string
  user_id: string
  title: string
  template: string
  doc_json: Json
  model: string
  created_at: string
  updated_at: string
}

/** Insert shape for the `resumes` table. */
export interface ResumeInsert {
  user_id: string
  title?: string
  template?: string
  doc_json?: Json
  model?: string
}

/** Update shape for the `resumes` table. */
export interface ResumeUpdate {
  title?: string
  template?: string
  doc_json?: Json
  model?: string
}

/** Row shape for the `app_settings` table. */
export interface AppSettingsRow {
  key: string
  value: Json
}

/** The admin-chosen OpenRouter model id. */
export interface AppSettings {
  openrouterModel: string
}

/** A single OpenRouter model entry (from GET /api/v1/models). */
export interface OpenRouterModel {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
}

/** Request body for the AI route. */
export interface AiRequest {
  /** The current ProseMirror document (for context). */
  doc?: ResumeDoc
  /** The user's instruction / prompt. */
  prompt: string
  /** Optional model override; falls back to app_settings. */
  model?: string
}

/** A streamed chunk from the AI route (SSE). */
export interface AiStreamChunk {
  /** Incremental text delta. */
  delta?: string
  /** Set once when the stream finishes. */
  done?: boolean
  /** Set on error. */
  error?: string
}

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useGlobal } from '@/lib/context/GlobalContext'
import type { BuiltinSkillDescriptor } from '@/lib/builtin-agents'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  FileIcon,
  Github,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { SkillPreviewDialog } from './SkillPreviewDialog'
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client'
import {
  deleteAgentSkill,
  importAgentSkillFromGithub,
  previewAgentSkill,
  previewBuiltinSkill,
  uploadAgentSkill,
  type AgentSkillRow,
} from './actions'

type TabId = 'shared' | 'mine'

export default function AgentSkillsPage() {
  const { user } = useGlobal()
  const [tab, setTab] = useState<TabId>('shared')
  const [skills, setSkills] = useState<AgentSkillRow[]>([])
  const [builtinSkills, setBuiltinSkills] = useState<BuiltinSkillDescriptor[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [showGithubDialog, setShowGithubDialog] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubName, setGithubName] = useState('')
  const [githubDescription, setGithubDescription] = useState('')
  const [importing, setImporting] = useState(false)

  const [skillToDelete, setSkillToDelete] = useState<AgentSkillRow | null>(null)
  const [skillToView, setSkillToView] = useState<AgentSkillRow | null>(null)
  const [builtinPreview, setBuiltinPreview] = useState<{ name: string; text: string } | null>(null)

  const shared = tab === 'shared'
  const canWrite = !shared && Boolean(user?.id)

  const seedFolderAndLoad = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const supabase = await createSPASassClient()
      if (user?.id) {
        await supabase.createAgentSkillsFolder(user.id)
      }
      const { data, error: listError } = await supabase.listAgentSkills()
      if (listError) throw listError
      setSkills((data || []).filter((skill) => skill.user_id === user?.id))
      const builtinRes = await fetch('/api/agent-skills', { cache: 'no-store' })
      const builtinJson = (await builtinRes.json()) as { builtinSkills?: BuiltinSkillDescriptor[] }
      if (builtinRes.ok) setBuiltinSkills(builtinJson.builtinSkills || [])
    } catch (err) {
      console.error('Error loading skills:', err)
      setError('Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      void seedFolderAndLoad()
    }
  }, [user?.id, seedFolderAndLoad])

  const openUploadDialog = useCallback((file: File) => {
    if (!canWrite) return
    setPendingFile(file)
    setUploadName('')
    setUploadDescription('')
    setShowUploadDialog(true)
  }, [canWrite])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) return
    openUploadDialog(fileList[0])
    event.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (!canWrite) return
      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length > 0) openUploadDialog(dropped[0])
    },
    [canWrite, openUploadDialog]
  )

  const handleUploadConfirm = async () => {
    if (!pendingFile) return
    try {
      setUploading(true)
      setError('')
      const formData = new FormData()
      formData.set('file', pendingFile)
      formData.set('skill_name', uploadName)
      formData.set('skill_description', uploadDescription)
      const result = await uploadAgentSkill(formData)
      if (!result.success) {
        setError(result.message)
        return
      }
      setShowUploadDialog(false)
      setPendingFile(null)
      setSuccess(result.message)
      await seedFolderAndLoad()
    } catch (err) {
      console.error('Error uploading skill:', err)
      setError('Failed to upload skill')
    } finally {
      setUploading(false)
    }
  }

  const handleGithubImport = async () => {
    if (!githubUrl.trim()) {
      setError('Paste a GitHub file URL.')
      return
    }
    try {
      setImporting(true)
      setError('')
      const payload = {
        url: githubUrl.trim(),
        skill_name: githubName,
        skill_description: githubDescription,
      }
      const result = await importAgentSkillFromGithub(payload)
      if (!result.success) {
        setError(result.message)
        return
      }
      setShowGithubDialog(false)
      setGithubUrl('')
      setGithubName('')
      setGithubDescription('')
      setSuccess(result.message)
      await seedFolderAndLoad()
    } catch (err) {
      console.error('Error importing skill:', err)
      setError('Failed to import from GitHub')
    } finally {
      setImporting(false)
    }
  }

  const handleDownload = async (skill: AgentSkillRow) => {
    try {
      setError('')
      const result = await previewAgentSkill(skill.id)
      if (!result.success || !result.data) throw new Error(result.message)
      const blob = new Blob([result.data.text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${skill.skill_name || 'skill'}.md`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading skill:', err)
      setError('Failed to open skill file')
    }
  }

  const handleDelete = async () => {
    if (!skillToDelete) return
    try {
      setError('')
      const result = await deleteAgentSkill(skillToDelete.id)
      if (!result.success) {
        setError(result.message)
        return
      }
      setSuccess(result.message)
      await seedFolderAndLoad()
    } catch (err) {
      console.error('Error deleting skill:', err)
      setError('Failed to delete skill')
    } finally {
      setSkillToDelete(null)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Skills Library</CardTitle>
          <CardDescription>
            Built-in Task Management skills are always on for that agent and cannot be edited.
            Skills you upload on Mine can be attached to General agent and Task Management.
            Plain General chat does not load them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1" aria-label="Skills library tabs">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'shared'}
                onClick={() => setTab('shared')}
                className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                  tab === 'shared'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Built-in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'mine'}
                onClick={() => setTab('mine')}
                className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                  tab === 'mine'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Mine
              </button>
            </nav>
          </div>

          {canWrite ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <label
                className={`flex-1 flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-lg tracking-wide border-2 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary-500 border-dashed bg-primary-50'
                    : 'border-primary-600 hover:bg-primary-50'
                }`}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className="w-8 h-8" />
                <span className="mt-2 text-sm text-center">
                  {uploading
                    ? 'Uploading...'
                    : isDragging
                      ? 'Drop your skill file here'
                      : 'Drag and drop or click to upload (.md, .txt, .json, .yml)'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".md,.markdown,.txt,.json,.yml,.yaml,text/markdown,text/plain,application/json"
                  onChange={handleInputChange}
                  disabled={uploading}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setShowGithubDialog(true)
                }}
                className="sm:w-56 flex flex-col items-center justify-center px-4 py-6 bg-white rounded-lg border-2 border-gray-300 hover:bg-gray-50"
              >
                <Github className="w-8 h-8" />
                <span className="mt-2 text-sm">Import from GitHub</span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Built-in task skills are read-only. Upload and GitHub import stay on Mine.
            </p>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : null}
            {shared ? (
              builtinSkills.map((skill) => (
                <div key={skill.slug} className="p-4 bg-white rounded-lg border">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="block font-medium break-words">{skill.name}</span>
                      <p className="mt-1 text-sm text-gray-500">{skill.description}</p>
                      <p className="mt-1 text-xs text-gray-400">Built-in · read-only</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void previewBuiltinSkill(skill.slug).then((result) => {
                          if (!result.success || !result.data) {
                            setError(result.message)
                            return
                          }
                          setBuiltinPreview({ name: result.data.name, text: result.data.text })
                        })
                      }}
                      className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <>
                {!loading && skills.length === 0 ? (
                  <p className="text-center text-gray-500">No personal skills yet</p>
                ) : null}
                {skills.map((skill) => (
                  <div key={skill.id} className="p-4 bg-white rounded-lg border">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileIcon className="mt-0.5 h-6 w-6 shrink-0 text-gray-400" />
                        <div className="min-w-0 flex-1">
                          <span className="block font-medium break-words">{skill.skill_name}</span>
                          {skill.skill_description ? (
                            <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500">
                              {skill.skill_description}
                            </p>
                          ) : null}
                          <p className="mt-1 truncate text-xs text-gray-400">
                            {skill.source === 'github' ? 'Imported from GitHub' : 'Uploaded'}
                            {skill.source_url ? ` · ${skill.source_url}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => setSkillToView(skill)}
                          className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownload(skill)}
                          className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-blue-600 hover:bg-blue-50"
                          aria-label={`Download ${skill.skill_name}`}
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkillToDelete(skill)}
                          className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                          aria-label={`Delete ${skill.skill_name}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload skill</DialogTitle>
            <DialogDescription>
              Name and description are optional. YAML frontmatter is used when you leave these blank.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 truncate">File: {pendingFile?.name}</p>
            <Input
              placeholder="Skill name (optional)"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={() => void handleUploadConfirm()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGithubDialog} onOpenChange={setShowGithubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from GitHub</DialogTitle>
            <DialogDescription>
              Paste a github.com blob link or a raw.githubusercontent.com URL. Private repositories
              are not supported.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="https://github.com/org/repo/blob/main/SKILL.md"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <Input
              placeholder="Skill name (optional)"
              value={githubName}
              onChange={(e) => setGithubName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={githubDescription}
              onChange={(e) => setGithubDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGithubDialog(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={() => void handleGithubImport()} disabled={importing}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkillPreviewDialog
        skill={skillToView}
        open={Boolean(skillToView)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSkillToView(null)
        }}
      />

      <Dialog open={Boolean(builtinPreview)} onOpenChange={(nextOpen) => { if (!nextOpen) setBuiltinPreview(null) }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{builtinPreview?.name ?? 'Built-in skill'}</DialogTitle>
            <DialogDescription>Read-only. This file cannot be deleted.</DialogDescription>
          </DialogHeader>
          {builtinPreview ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-700">
              {builtinPreview.text}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(skillToDelete)}
        onOpenChange={(open) => {
          if (!open) setSkillToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
            <AlertDialogDescription>
              {skillToDelete
                ? `“${skillToDelete.skill_name}” will be removed from the library and storage.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

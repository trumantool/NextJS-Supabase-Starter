'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useGlobal } from '@/lib/context/GlobalContext'
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
  deleteSharedAgentSkill,
  importAgentSkillFromGithub,
  importSharedAgentSkillFromGithub,
  uploadAgentSkill,
  uploadSharedAgentSkill,
  type AgentSkillRow,
} from './actions'

type TabId = 'shared' | 'mine'

export default function AgentSkillsPage() {
  const { user, isAdmin } = useGlobal()
  const [tab, setTab] = useState<TabId>('shared')
  const [skills, setSkills] = useState<AgentSkillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [writeShared, setWriteShared] = useState(false)

  const [showGithubDialog, setShowGithubDialog] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubName, setGithubName] = useState('')
  const [githubDescription, setGithubDescription] = useState('')
  const [importing, setImporting] = useState(false)

  const [skillToDelete, setSkillToDelete] = useState<AgentSkillRow | null>(null)
  const [skillToView, setSkillToView] = useState<AgentSkillRow | null>(null)

  const shared = tab === 'shared'
  const canWrite = shared ? isAdmin : Boolean(user?.id)

  useEffect(() => {
    if (user?.id) {
      void seedFolderAndLoad()
    }
  }, [user?.id])

  const seedFolderAndLoad = async () => {
    try {
      setLoading(true)
      setError('')
      const supabase = await createSPASassClient()
      if (user?.id) {
        await supabase.createAgentSkillsFolder(user.id)
      }
      const { data, error: listError } = await supabase.listAgentSkills()
      if (listError) throw listError
      setSkills(data || [])
    } catch (err) {
      console.error('Error loading skills:', err)
      setError('Failed to load skills')
    } finally {
      setLoading(false)
    }
  }

  const visibleSkills = skills.filter((skill) =>
    shared ? skill.user_id === null : skill.user_id === user?.id
  )

  const openUploadDialog = (file: File) => {
    if (!canWrite) return
    setWriteShared(shared)
    setPendingFile(file)
    setUploadName('')
    setUploadDescription('')
    setShowUploadDialog(true)
  }

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
    [canWrite, shared]
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
      const result = writeShared
        ? await uploadSharedAgentSkill(formData)
        : await uploadAgentSkill(formData)
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
      const result = writeShared
        ? await importSharedAgentSkillFromGithub(payload)
        : await importAgentSkillFromGithub(payload)
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
      const supabase = await createSPASassClient()
      const { data, error: signError } = await supabase.signAgentSkillUrl(skill.skill_url, 60, true)
      if (signError || !data?.signedUrl) throw signError || new Error('No signed URL')
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      console.error('Error downloading skill:', err)
      setError('Failed to open skill file')
    }
  }

  const handleDelete = async () => {
    if (!skillToDelete) return
    try {
      setError('')
      const result = writeShared
        ? await deleteSharedAgentSkill(skillToDelete.id)
        : await deleteAgentSkill(skillToDelete.id)
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
            Markdown instructions agents can attach. Shared skills are readable by everyone;
            your skills stay under <code>{'{auth.uid()}/'}</code> in the agent-skills bucket.
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
                Shared
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
                  setWriteShared(shared)
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
              Shared skills are read-only. Only admins can add or remove default skills.
            </p>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : null}
            {!loading && visibleSkills.length === 0 ? (
              <p className="text-center text-gray-500">
                {shared ? 'No shared skills yet' : 'No personal skills yet'}
              </p>
            ) : null}
            {visibleSkills.map((skill) => (
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
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWriteShared(shared)
                          setSkillToDelete(skill)
                        }}
                        className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                        aria-label={`Delete ${skill.skill_name}`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
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

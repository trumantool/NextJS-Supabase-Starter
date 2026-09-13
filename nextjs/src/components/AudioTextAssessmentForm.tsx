'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { QuestionBlock } from './QuestionBlock'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Download, ChevronDown, Plus, Loader2 } from 'lucide-react'

// Text assessment uses API routes (same pattern as resume builder)
// to avoid the "Invalid Server Actions request" issue.

// The questionnaire data structure
const QUESTIONNAIRE_DATA = [
  {
    section: '1.1 Criminal History',
    questions: [
      'How old were you the first time you were arrested?',
      '*Based on answer above, confirm no arrests under age 18.*',
      'What types of charges have you been arrested for?',
      'How many times have you been incarcerated/had to serve time?',
      'As a juvenile? As an adult?',
      'When were you last released?',
      "What's the longest amount of time you've had to serve?",
      'When incarcerated, did you have any behavior problems, confinements, DRs? If yes, for what and how many times?',
      'Are you currently on probation? If yes, what type of charge?',
      'Have you been on probation in the past? If yes, have you ever violated your probation? How did you violate (non-compliance? Failed drug test? Failure to report? Etc.)',
      'Do you have any outstanding or pending charges?',
    ],
  },
  {
    section: '1.2 Education/Employment',
    questions: [
      "What's the highest grade you completed in school?",
      'When you were in school, did you have any extra assistance in any subjects or repeat any grades?',
      'Were you ever suspended or expelled?',
      'Are you currently employed? If yes, full-time or part-time? Where?',
      'Out of the last 12 months, how many have you been employed?',
      "What's the longest you've been employed for?",
      'Have you ever been unemployed in the community for 12 months?',
      'What industries have you worked in/types of jobs have you held in the past?',
      'What did you like or dislike about your past employment?',
      'Did you get along with your coworkers?',
      'Did you like working for your supervisor?',
    ],
  },
  {
    section: '1.3 Family/Marital',
    questions: [
      'What is your current relationship status?',
      '*Follow-up questions based on answer above*',
      'If in a relationship- how is your current relationship on scale of 1-10? Are you getting along? Any concerns with intimacy (emotional or physical), jealousy, finances, friends, infidelity, intimacy etc.?',
      'If single- how do you feel about being single? Do you enjoy the single life, are you actively looking for someone, etc.?',
      'Have you ever been married?',
      'Do you have any children? If yes, ages, how often do you see/communicate with them?',
      'Where did you grow up? Who were you raised by? How often do you talk with them or see them? (If not raised by parents- explore if there is a relationship/contact with them if answer isn\'t already provided)',
      'Tell me about your relationship with other family members? Siblings, aunt, uncles, cousins, grandparents etc. How often do you talk with them or see them?',
      'Does anyone in your family, including spouse/significant other and close relatives have a criminal record?',
    ],
  },
  {
    section: '1.4 Leisure/Recreation',
    questions: [
      'Are you active in any organized activities, clubs, groups etc.?',
      'What do you like to do in your free time? Any hobbies or activities you enjoy?',
    ],
  },
  {
    section: '1.5 Companions',
    questions: [
      '"I know some people like to have tons of friends and acquaintances and some prefer just a few. How would you classify yourself?',
      'Of the people you know, what % of them would you say have had trouble with the law?',
      'Do you know many people or have many friends not involved in criminal activities?',
      'How do you feel about being in larger groups?',
    ],
  },
  {
    section: '1.6 Alcohol/Drug Problems',
    questions: [
      'Do you have any history of drug or alcohol abuse?',
      '*Based on answer above.*',
      "What is your drug(s) of choice? When were you last using? Have your drug use habits changed in the last year?",
      'How much do you drink? Have your drinking habits changed in the last year?',
      'Has your drug or alcohol use contributed to your arrests or law violations?',
      'Have your family or friends expressed concern about your drug or alcohol use?',
      'Have you experienced problems with employment due to your drug or alcohol use?',
      'Have you had any medical problems due to your drug or alcohol use? (OD, doctor encouraged you to stop using, blackouts, withdrawal etc.)',
    ],
  },
  {
    section: '1.7 Procriminal Attitude/Orientation',
    questions: [
      "How do you feel about the crimes you've committed?",
      'Would you like to lead a life without crime?',
      'Do you think your sentence was appropriate and fair?',
      'Do you feel that the supervision you are/were placed under is/was appropriate fair?',
    ],
  },
  {
    section: '1.8 Antisocial Patterns',
    questions: [
      'Have you ever been given a mental health diagnosis or evaluated for mental health concerns? (depression, anxiety, PTSD, etc.)',
      'Do you have any history of violent offenses?',
      'Have you had any history of escape or attempted escape from custody?',
      'Do you have any current source of income? If yes, how much per month?',
      'Do you receive any assistance from family, friends, or government like SNAP?',
      'Do you have any existing debts? (Court fines/fees? Medical expenses?) If yes, approximately how much?',
      'How many residential addresses have you had in the past year?',
    ],
  },
  {
    section: 'Section 2',
    questions: [
      'If on probation- is your probation officer fair/reasonable?',
      'Are you afraid of anyone hurting or harming you?',
      'Any concerns regarding problems solving such as acting impulsively, setting goals, getting in trouble by almost by accident?',
      'Any concerns regarding anger or frustration such as getting impatient with others, arguing with friends or family, physical fights?',
      'Any intimidating or controlling behavior such as physically hurting your partner, jealously etc.?',
      'Has anyone accused you of sexually inappropriate behavior such as streaking, masturbating in public, sexual assault or sexual violence?',
      'Are you a sociable person, does making friends or meeting strangers come easy to you?',
      'Are most of your friends your age, older or younger than you?',
      'Have you experienced racist or sexist behavior- you towards others or others towards you?',
      'Any history of physical violence towards others? Specifically- strangers, own children, partner, authority figures etc.',
      'Any history of stalking or harassing behavior? For example, call text, call text, threatening someone, etc.',
      'Have you ever used a weapon to hurt or harm someone?',
      'Have you ever intentionally set fire to destroy property or harm someone?',
      'Any history of driving under the influence or DUI charges?',
      'Any history of shoplifting?',
      'Any history of gang involvement, organized crime, white collar crime, embezzlement, hate crime or terrorist activity?',
    ],
  },
  {
    section: 'Section 3',
    questions: [
      'Your last incarceration, was it federal, state or county?',
      'What level of supervision/security? Minimum, medium, maximum?',
    ],
  },
  {
    section: 'Section 4 and Section 5',
    questions: [
      'What is your current living situation? Family, friends, transitional housing?',
      'How do you like the place where you are living?',
      'Are you a citizen? Is English your first language?',
      'If the client has children, do you have any parenting concerns? Trouble with your child listening to you, emotional distance, defiance etc.',
      'Do you have any health concerns such as heart disease, diabetes, high blood pressure, hepatitis, HIV etc.? If yes, are you currently receiving medical care?',
      'Have you been experiencing sadness or depression? Or feeling unhappy with yourself?',
      'Have you ever experienced suicidal thoughts? Have you ever attempted suicide?',
      'Have you ever been to a crisis stabilization unit or hospitalized for mental health concerns?',
      'Are you currently taking, or have you taken psychotropic medications in the past?',
      'Do you have any history of hearing voices or seeing things other people don\'t see or hear?',
      'Any history of feeling things are "unreal" or uncontrollable urges/ideas?',
      'Have you experienced forms of abuse including emotional, physical or sexual?',
      'If yes, note by who, when and current effects based on client\'s willingness to answer.',
      'Do you have any needs or concerns we have not discussed yet?',
      'Health, emotional, personal, cultural or religious traditions your team needs to be aware of to assist you?',
      'What do you hope to achieve in this program?',
      'Where do you see yourself in 5 years?',
      'Is there anything that will hinder you from successfully completing this program or reaching your goals?',
    ],
  },
]

export function AudioTextAssessmentForm() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [recordedQuestions, setRecordedQuestions] = useState<Set<number>>(new Set())
  const [uploadingQuestions, setUploadingQuestions] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))
  const [isExporting, setIsExporting] = useState(false)
  const [transcripts, setTranscripts] = useState<Record<number, string>>({})

  // Text assessment state
  const [textAssessmentId, setTextAssessmentId] = useState<string | null>(null)
  const [textAssessmentName, setTextAssessmentName] = useState('')
  const [showNewAssessmentDialog, setShowNewAssessmentDialog] = useState(false)
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [savingQuestions, setSavingQuestions] = useState<Set<number>>(new Set())
  const [assessmentsList, setAssessmentsList] = useState<Array<{ id: string; name: string; created_at: string }>>([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const saveTimersRef = useRef<Record<number, NodeJS.Timeout>>({})

  const totalQuestions = QUESTIONNAIRE_DATA.reduce((sum, section) => sum + section.questions.length, 0)
  const recordedCount = recordedQuestions.size
  const answeredCount = answeredQuestions.size

  // ── Text Assessment Functions (API routes) ───────────────────────────

  const loadAssessments = useCallback(async () => {
    setLoadingAssessments(true)
    try {
      const res = await fetch('/audio-text-assessment/api/text-assessments')
      if (!res.ok) throw new Error('Failed to load')
      const { assessments } = await res.json()
      setAssessmentsList(assessments.map((a: { id: string; name: string; created_at: string }) => ({
        id: a.id,
        name: a.name,
        created_at: a.created_at,
      })))
    } catch (error) {
      console.error('Failed to load assessments:', error)
    } finally {
      setLoadingAssessments(false)
    }
  }, [])

  // Load existing assessments on mount
  useEffect(() => {
    loadAssessments()
  }, [loadAssessments])

  const handleCreateAssessment = useCallback(async () => {
    const trimmed = textAssessmentName.trim()
    if (!trimmed) return

    setIsCreatingAssessment(true)
    try {
      const res = await fetch('/audio-text-assessment/api/text-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const { assessment } = await res.json()
      setTextAssessmentId(assessment.id)
      setTextAssessmentName('')
      setShowNewAssessmentDialog(false)
      // A brand-new assessment is blank: clear all text fields and answered
      // state immediately so no answers carry over from the previous assessment.
      setTranscripts({})
      setAnsweredQuestions(new Set())
      // Pre-populate the answered questions set for this assessment (will be empty
      // for a new assessment; ensures answers are blank in the DB too).
      const ansRes = await fetch(`/audio-text-assessment/api/text-assessments/${assessment.id}/answers`)
      if (ansRes.ok) {
        const { answers } = await ansRes.json()
        const answered = new Set<number>()
        const transcriptMap: Record<number, string> = {}
        for (const answer of answers) {
          answered.add(answer.question_number)
          transcriptMap[answer.question_number] = answer.answer_text
        }
        // Replace (not merge) so stale answers from a previous assessment never persist.
        setAnsweredQuestions(answered)
        setTranscripts(transcriptMap)
      }
      await loadAssessments()
    } catch (error) {
      console.error('Failed to create assessment:', error)
      alert('Failed to create assessment. Please try again.')
    } finally {
      setIsCreatingAssessment(false)
    }
  }, [textAssessmentName, loadAssessments])

  const handleSelectAssessment = useCallback(async (assessmentId: string) => {
    setTextAssessmentId(assessmentId)
    try {
      const res = await fetch(`/audio-text-assessment/api/text-assessments/${assessmentId}/answers`)
      if (!res.ok) throw new Error('Failed to load answers')
      const { answers } = await res.json()
      const answered = new Set<number>()
      const transcriptMap: Record<number, string> = {}
      for (const answer of answers) {
        answered.add(answer.question_number)
        transcriptMap[answer.question_number] = answer.answer_text
      }
      // Replace (not merge) so answers from a previously selected assessment
      // don't bleed into the newly selected one.
      setAnsweredQuestions(answered)
      setTranscripts(transcriptMap)
    } catch (error) {
      console.error('Failed to load assessment answers:', error)
      // If loading fails, clear the fields so stale answers aren't shown.
      setAnsweredQuestions(new Set())
      setTranscripts({})
    }
  }, [])

  const handleTextAnswerChange = useCallback(
    (questionNumber: number, questionText: string, sectionTitle: string, sectionIndex: number, value: string) => {
      // Update local state immediately
      setTranscripts((prev) => ({ ...prev, [questionNumber]: value }))

      if (!textAssessmentId) return

      // Clear existing timer for this question
      if (saveTimersRef.current[questionNumber]) {
        clearTimeout(saveTimersRef.current[questionNumber])
      }

      // Mark as saving
      setSavingQuestions((prev) => new Set([...prev, questionNumber]))

      // Debounce the save (800ms)
      saveTimersRef.current[questionNumber] = setTimeout(async () => {
        try {
          const res = await fetch(`/audio-text-assessment/api/text-assessments/${textAssessmentId}/answers`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionNumber,
              questionText,
              sectionTitle,
              sectionIndex,
              answerText: value,
            }),
          })
          if (!res.ok) throw new Error('Failed to save')
          setAnsweredQuestions((prev) => new Set([...prev, questionNumber]))
        } catch (error) {
          console.error('Failed to save answer:', error)
        } finally {
          setSavingQuestions((prev) => {
            const next = new Set(prev)
            next.delete(questionNumber)
            return next
          })
        }
      }, 800)
    },
    [textAssessmentId]
  )

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = saveTimersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  // ── Audio Assessment Functions ─────────────────────────────────────────

  // Initialize assessment on first record
  const initializeAssessment = useCallback(async () => {
    if (assessmentId) return assessmentId

    try {
      const res = await fetch('/audio-text-assessment/api/audio-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionIndex: 0,
          sectionTitle: 'Audio-Text Assessment',
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const { assessment } = await res.json()
      setAssessmentId(assessment.id)
      return assessment.id
    } catch (error) {
      console.error('Failed to create assessment:', error)
      alert('Failed to start assessment. Please try again.')
      return null
    }
  }, [assessmentId])

  const handleRecordingComplete = useCallback(
    async (
      questionNumber: number,
      questionText: string,
      sectionTitle: string,
      blob: Blob,
      duration: number,
      transcript: string = ''
    ) => {
      // Update transcript in state first
      if (transcript) {
        setTranscripts((prev) => ({
          ...prev,
          [questionNumber]: transcript,
        }))
      }

      // Get or create assessment
      let currentAssessmentId = assessmentId
      if (!currentAssessmentId) {
        currentAssessmentId = await initializeAssessment()
        if (!currentAssessmentId) return
      }

      // Mark as uploading
      setUploadingQuestions((prev) => new Set([...prev, questionNumber]))

      try {
        // Upload audio file + save response record via API route
        const formData = new FormData()
        formData.append('audio', blob, `q${questionNumber}.webm`)
        formData.append('questionNumber', String(questionNumber))
        formData.append('questionText', questionText)
        formData.append('sectionTitle', sectionTitle)
        formData.append('transcriptText', transcript)
        formData.append('durationSeconds', String(duration))

        const res = await fetch(
          `/audio-text-assessment/api/audio-assessments/${currentAssessmentId}/responses`,
          { method: 'POST', body: formData }
        )
        if (!res.ok) throw new Error('Failed to save recording')

        // Mark as recorded
        setRecordedQuestions((prev) => new Set([...prev, questionNumber]))
      } catch (error) {
        console.error('Failed to upload recording:', error)
        alert(`Failed to save recording for question ${questionNumber}. Please try again.`)
      } finally {
        // Mark as done uploading
        setUploadingQuestions((prev) => {
          const next = new Set(prev)
          next.delete(questionNumber)
          return next
        })
      }
    },
    [assessmentId, initializeAssessment]
  )

  const handleTranscriptChange = useCallback((questionNumber: number, text: string) => {
    setTranscripts((prev) => ({
      ...prev,
      [questionNumber]: text,
    }))
  }, [])

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const exportAssessment = async () => {
    if (!assessmentId) {
      alert('No assessment to export.')
      return
    }

    setIsExporting(true)
    try {
      // Create a manifest of all recorded questions
      const recordedQuestionsData = Array.from(recordedQuestions).map((qNum) => {
        let currentQNum = 0
        for (const section of QUESTIONNAIRE_DATA) {
          for (const question of section.questions) {
            currentQNum++
            if (currentQNum === qNum) {
              return {
                number: qNum,
                text: question,
                section: section.section,
                transcript: transcripts[qNum] || '',
              }
            }
          }
        }
        return { number: qNum }
      })

      const manifest = {
        assessmentId,
        totalQuestions,
        recordedQuestions: recordedCount,
        percentage: Math.round((recordedCount / totalQuestions) * 100),
        exportedAt: new Date().toISOString(),
        questions: recordedQuestionsData,
      }

      // For now, just log the manifest
      console.log('Assessment Export:', manifest)
      alert(
        `Assessment exported! Recorded ${recordedCount} out of ${totalQuestions} questions (${Math.round((recordedCount / totalQuestions) * 100)}%)`
      )
    } catch (error) {
      console.error('Failed to export assessment:', error)
      alert('Failed to export assessment.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>Intake Assessment Questionnaire</CardTitle>
          <CardDescription>
            Record responses with automatic transcription, or type answers directly. All data is securely saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Top row: progress + action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-600">
                {textAssessmentId && (
                  <p className="font-medium text-gray-900">
                    {answeredCount} of {totalQuestions} answered
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {Math.round((answeredCount / totalQuestions) * 100)}% answered
                </p>
                <ProgressBar value={(answeredCount / totalQuestions) * 100} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={exportAssessment}
                  disabled={isExporting || recordedCount === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export Results'}
                </Button>
              </div>
            </div>

            {/* Text Assessment row: selector + new button */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t pt-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Assessment</label>
                {loadingAssessments ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading assessments...
                  </p>
                ) : assessmentsList.length > 0 ? (
                  <select
                    value={textAssessmentId ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewAssessmentDialog(true)
                      } else {
                        handleSelectAssessment(e.target.value)
                      }
                    }}
                    className="w-full sm:w-auto min-w-[240px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— Select an assessment —</option>
                    {assessmentsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({new Date(a.created_at).toLocaleDateString()})
                      </option>
                    ))}
                    <option value="__new__">+ Start New Assessment</option>
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">No assessments yet</p>
                )}
              </div>
              <Button
                onClick={() => setShowNewAssessmentDialog(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white self-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start New Assessment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Assessment Dialog */}
      <Dialog open={showNewAssessmentDialog} onOpenChange={setShowNewAssessmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Text Assessment</DialogTitle>
            <DialogDescription>
              Give this assessment a name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="assessment-name" className="block text-sm font-medium text-gray-700 mb-1">
                Assessment Name
              </label>
              <Input
                id="assessment-name"
                value={textAssessmentName}
                onChange={(e) => setTextAssessmentName(e.target.value)}
                placeholder="e.g. John Smith - Initial Assessment"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textAssessmentName.trim()) {
                    handleCreateAssessment()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewAssessmentDialog(false)
                setTextAssessmentName('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAssessment}
              disabled={!textAssessmentName.trim() || isCreatingAssessment}
            >
              {isCreatingAssessment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Assessment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions Sections — only shown once an assessment is selected or created */}
      {textAssessmentId ? (
        <>
        <div className="space-y-4">
        {QUESTIONNAIRE_DATA.map((section, sectionIndex) => (
          <Card key={sectionIndex}>
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection(sectionIndex)}
            >
              <h2 className="text-lg font-semibold text-gray-900">{section.section}</h2>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  expandedSections.has(sectionIndex) ? 'rotate-180' : ''
                }`}
              />
            </div>

            {expandedSections.has(sectionIndex) && (
              <CardContent className="border-t pt-4 space-y-6">
                {section.questions.map((question, questionIndex) => {
                  const globalQuestionNumber =
                    QUESTIONNAIRE_DATA.slice(0, sectionIndex).reduce((sum, s) => sum + s.questions.length, 0) +
                    questionIndex +
                    1

                  return (
                    <QuestionBlock
                      key={globalQuestionNumber}
                      questionNumber={globalQuestionNumber}
                      questionText={question}
                      sectionTitle={section.section}
                      isRecorded={recordedQuestions.has(globalQuestionNumber)}
                      isUploading={uploadingQuestions.has(globalQuestionNumber)}
                      transcript={transcripts[globalQuestionNumber] || ''}
                      onRecordingComplete={(qNum, qText, sectionTitle, blob, duration) =>
                        handleRecordingComplete(qNum, qText, sectionTitle, blob, duration)
                      }
                      onTranscriptChange={(qNum, text) =>
                        textAssessmentId
                          ? handleTextAnswerChange(qNum, question, section.section, sectionIndex, text)
                          : handleTranscriptChange(qNum, text)
                      }
                      isSaving={savingQuestions.has(globalQuestionNumber)}
                      storageFolder="audio-text-audio"
                    />
                  )
                })}
              </CardContent>
            )}
          </Card>
        ))}
        </div>

        {/* Footer Summary */}
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                {answeredCount} of {totalQuestions} answered
              </p>
              <p className="text-sm text-gray-600">
                {recordedCount === totalQuestions
                  ? '✓ All questions recorded!'
                  : `${totalQuestions - recordedCount} questions remaining`}
              </p>
            </div>
          </CardContent>
        </Card>
        </>
      ) : (
        /* Empty state — prompt the user to select or create an assessment first */
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-base font-medium text-gray-900 mb-2">No Assessment Selected</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Select a previous assessment from the dropdown above, or click
              <span className="font-medium text-primary-600"> Start New Assessment </span>
              to begin answering the questionnaire.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

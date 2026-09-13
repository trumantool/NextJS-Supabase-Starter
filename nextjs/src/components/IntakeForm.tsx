'use client'

import React, { useState, useCallback } from 'react'
import { QuestionBlock } from './QuestionBlock'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Download, ChevronDown } from 'lucide-react'

// ASSESSMENT FLOW NOTE:
// Intake recordings are saved through API routes (same pattern as the resume
// builder and the audio-text-assessment page) to avoid the
// "Invalid Server Actions request" issue.

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


export function IntakeForm() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [recordedQuestions, setRecordedQuestions] = useState<Set<number>>(new Set())
  const [uploadingQuestions, setUploadingQuestions] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))
  const [isExporting, setIsExporting] = useState(false)

  const totalQuestions = QUESTIONNAIRE_DATA.reduce((sum, section) => sum + section.questions.length, 0)
  const recordedCount = recordedQuestions.size

  // Initialize assessment on first record
  const initializeAssessment = useCallback(async () => {
    if (assessmentId) return assessmentId

    try {
      const res = await fetch('/intake/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionIndex: 0,
          sectionTitle: 'Intake Assessment',
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
      duration: number
    ) => {
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
        formData.append('durationSeconds', String(duration))

        const res = await fetch(
          `/intake/api/assessments/${currentAssessmentId}/responses`,
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
      // Build a flat list of all questions with their global numbers
      const allQuestions = QUESTIONNAIRE_DATA.flatMap((sec, sectionIndex) => {
        let sectionStartNumber = 1
        for (let i = 0; i < sectionIndex; i++) {
          sectionStartNumber += QUESTIONNAIRE_DATA[i].questions.length
        }
        return sec.questions.map((q, i) => ({
          text: q,
          section: sec.section,
          number: sectionStartNumber + i,
        }))
      })
      // Create a manifest of all recorded questions
      const manifest = {
        assessmentId,
        totalQuestions,
        recordedQuestions: recordedCount,
        percentage: Math.round((recordedCount / totalQuestions) * 100),
        exportedAt: new Date().toISOString(),
        questions: Array.from(recordedQuestions).map((qNum) => {
          return allQuestions[qNum - 1] || { number: qNum }
        }),
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
            Record responses to all questions. Your audio will be securely saved to our database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">
                Progress: {recordedCount} of {totalQuestions} questions recorded
              </p>
              <ProgressBar value={(recordedCount / totalQuestions) * 100} />
            </div>
            <Button onClick={exportAssessment} disabled={isExporting} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Progress'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {QUESTIONNAIRE_DATA.map((section, sectionIndex) => {
          // Calculate starting question number for this section
          let sectionStartNumber = 1
          for (let i = 0; i < sectionIndex; i++) {
            sectionStartNumber += QUESTIONNAIRE_DATA[i].questions.length
          }

          const sectionQuestions = section.questions
          const isExpanded = expandedSections.has(sectionIndex)
          const sectionRecordedCount = sectionQuestions.filter((_, i) =>
            recordedQuestions.has(sectionStartNumber + i)
          ).length

          const sectionContent = sectionQuestions.map((questionText, questionIndex) => {
            const questionNumber = sectionStartNumber + questionIndex
            const isRecorded = recordedQuestions.has(questionNumber)
            const isUploading = uploadingQuestions.has(questionNumber)

            return (
              <QuestionBlock
                key={questionNumber}
                questionNumber={questionNumber}
                questionText={questionText}
                sectionTitle={section.section}
                isRecorded={isRecorded}
                isUploading={isUploading}
                onRecordingComplete={(qNum, qText, sectionTitle, blob, duration) =>
                  handleRecordingComplete(qNum, qText, sectionTitle, blob, duration)
                }
              />
            )
          })

          return (
            <Card key={sectionIndex} className="overflow-hidden">
              <button
                onClick={() => toggleSection(sectionIndex)}
                className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900">{section.section}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {sectionRecordedCount} of {sectionQuestions.length} recorded
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {isExpanded && (
                <CardContent className="border-t border-gray-200 space-y-4 p-4 sm:p-6">
                  {sectionContent}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Summary Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                Assessment Status: <span className="font-medium text-gray-900">{recordedCount > 0 ? 'In Progress' : 'Not Started'}</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Completion: <span className="font-medium text-gray-900">{Math.round((recordedCount / totalQuestions) * 100)}%</span>
              </p>
            </div>
            <Button onClick={exportAssessment} disabled={isExporting || recordedCount === 0} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Download Assessment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

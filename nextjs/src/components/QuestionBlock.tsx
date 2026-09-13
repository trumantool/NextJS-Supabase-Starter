'use client'

import React, { useState, useRef } from 'react'
import { AudioRecorder, type AudioRecorderHandle } from './AudioRecorder'
import { CheckCircle2 } from 'lucide-react'

interface QuestionBlockProps {
  questionNumber: number
  questionText: string
  sectionTitle?: string
  isRecorded: boolean
  onRecordingComplete: (questionNumber: number, questionText: string, sectionTitle: string, blob: Blob, duration: number, transcript: string) => void
  isUploading?: boolean
  transcript?: string
  onTranscriptChange?: (questionNumber: number, text: string) => void
  isSaving?: boolean
  storageFolder?: string
}

export function QuestionBlock({
  questionNumber,
  questionText,
  isRecorded,
  transcript = '',
  onTranscriptChange,
  isSaving = false,
}: QuestionBlockProps) {
  const [showRecorder, setShowRecorder] = useState(false)
  const recorderRef = useRef<AudioRecorderHandle>(null)

  // Trigger mic access + recording synchronously within the click's user gesture
  const handleStartTextToSpeech = () => {
    setShowRecorder(true)
    // Recorder is already mounted (hidden) so we can start it synchronously here,
    // keeping the browser's user activation so mic/speech recognition work.
    recorderRef.current?.start()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4">
      {/* Question Header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
            {questionNumber}
          </div>
        </div>
        <div className="flex-grow">
          <p className="text-base font-medium text-gray-900">{questionText}</p>
        </div>
        {isRecorded && (
          <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Recorded</span>
          </div>
        )}
      </div>

      {/* Recording + Answer Area */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left column: recording controls */}
        <div className="md:w-1/5 flex flex-col gap-2">
          {!showRecorder && !isRecorded && (
            <button
              onClick={handleStartTextToSpeech}
              className="py-2 px-4 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
            >
              + Text to Speech
            </button>
          )}

          {!isRecorded && (
            <div className={showRecorder ? '' : 'hidden'}>
              <AudioRecorder
                ref={recorderRef}
                onRecordingComplete={(blob, duration, transcript) => {
                  // Only insert the transcribed text — audio files are no longer saved
                  onTranscriptChange?.(questionNumber, transcript)
                  setShowRecorder(false)
                }}
              />
            </div>
          )}
        </div>

        {/* Right column: textarea (shown by default when editable) */}
        {onTranscriptChange && (
          <div className="md:flex-1 min-w-[80%] space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">
                My Answer
              </label>
              {isSaving && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-300 border-t-primary-500" />
                  Saving...
                </span>
              )}
            </div>
            <textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(questionNumber, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full min-h-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}
      </div>
    </div>
  )
}

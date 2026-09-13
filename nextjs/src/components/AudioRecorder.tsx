'use client'

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Mic, Square, Play, Pause, Volume2 } from 'lucide-react'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number, transcript: string) => void
  onRecordingStart?: () => void
}

export interface AudioRecorderHandle {
  start: () => Promise<void>
}

const capitalizeFirstLetter = (text: string): string => {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  audioBlob: Blob | null
  duration: number
  currentTime: number
  transcript: string
  isListening: boolean
  isSpeechRecognitionSupported: boolean
}

type SpeechRecognitionType = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
  isFinal: boolean
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

export const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(function AudioRecorder(
  { 
    onRecordingComplete,
    onRecordingStart
  },
  ref
) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    audioBlob: null,
    duration: 0,
    currentTime: 0,
    transcript: '',
    isListening: false,
    isSpeechRecognitionSupported: false,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionType | null>(null)
  const interimTranscriptRef = useRef<string>('')
  const transcriptRef = useRef<string>('')

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionType; webkitSpeechRecognition?: new () => SpeechRecognitionType }).SpeechRecognition || (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionType; webkitSpeechRecognition?: new () => SpeechRecognitionType }).webkitSpeechRecognition
    
    if (SpeechRecognition) {
      setState(prev => ({ ...prev, isSpeechRecognitionSupported: true }))
      
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      
      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true }))
      }
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        interimTranscriptRef.current = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          
          if (event.results[i].isFinal) {
            setState(prev => {
              const updatedTranscript = capitalizeFirstLetter((prev.transcript + ' ' + transcript).trim())
              transcriptRef.current = updatedTranscript
              return { ...prev, transcript: updatedTranscript }
            })
          } else {
            interimTranscriptRef.current += transcript + ' '
          }
        }
      }
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'no-speech') {
          // Continue listening silently
        }
      }
      
      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }))
        // Restart listening if still recording
        if (state.isRecording && !state.isPaused) {
          try {
            recognition.start()
          } catch {
            // Already started
          }
        }
      }
      
      speechRecognitionRef.current = recognition
    }
  }, [])

  const startSpeechRecognition = () => {
    if (speechRecognitionRef.current && state.isSpeechRecognitionSupported) {
      try {
        interimTranscriptRef.current = ''
        speechRecognitionRef.current.start()
      } catch {
        console.log('Speech recognition already started')
      }
    }
  }

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop()
      } catch {
        console.log('Could not stop speech recognition')
      }
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio context for visualization (optional)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as Record<string, unknown>).webkitAudioContext as typeof AudioContext)()
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })

      chunksRef.current = []

      // Start timer
      let seconds = 0
      timerIntervalRef.current = setInterval(() => {
        seconds++
        setState((prev) => ({
          ...prev,
          duration: seconds,
        }))
      }, 1000)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop())
        stopSpeechRecognition()

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }

        const finalTranscript = capitalizeFirstLetter(transcriptRef.current.trim())
        const durationSeconds = Math.max(1, seconds)

        // Auto-insert the transcribed text without saving the audio file
        onRecordingComplete(new Blob(chunksRef.current, { type: 'audio/webm' }), durationSeconds, finalTranscript)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        currentTime: 0,
      }))

      onRecordingStart?.()
      startSpeechRecognition()
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Unable to access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop()
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      if (state.isPaused) {
        mediaRecorderRef.current.resume()
        setState((prev) => ({ ...prev, isPaused: false }))
        startSpeechRecognition()
      } else {
        mediaRecorderRef.current.pause()
        setState((prev) => ({ ...prev, isPaused: true }))
        stopSpeechRecognition()
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      stopSpeechRecognition()
    }
  }, [])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Expose start() so the parent can trigger recording within a user gesture
  useImperativeHandle(ref, () => ({
    start: () => startRecording(),
  }))

  return (
    <div className="space-y-3">
      {/* Recording Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!state.isRecording && !state.audioBlob && (
          <button
            onClick={startRecording}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
        )}

        {state.isRecording && (
          <>
            <button
              onClick={pauseRecording}
              className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
            >
              {state.isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </button>

            <button
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>

            <span className="ml-auto text-sm font-medium text-gray-700">
              {formatTime(state.duration)}
            </span>
          </>
        )}
      </div>

      {/* Speech Recognition Status Indicator */}
      {state.isRecording && state.isSpeechRecognitionSupported && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <Volume2 className="h-3 w-3 animate-pulse" />
          <span>
            {state.isListening ? 'Listening and transcribing...' : 'Initializing speech recognition...'}
          </span>
        </div>
      )}

      {/* Transcript Display During Recording */}
      {state.isRecording && (state.transcript || interimTranscriptRef.current) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-700 mb-2">Live Transcript:</p>
          <p className="text-sm text-gray-800 leading-relaxed">
            <span>{state.transcript}</span>
            {interimTranscriptRef.current && (
              <span className="italic text-gray-500 opacity-60">{interimTranscriptRef.current}</span>
            )}
          </p>
        </div>
      )}

      {/* Timer Display During Recording */}
      {state.isRecording && (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-lg animate-pulse">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-700">{formatTime(state.duration)}</span>
        </div>
      )}
    </div>
  )
})

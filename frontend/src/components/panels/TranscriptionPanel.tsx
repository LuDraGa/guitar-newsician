import { useState, useEffect } from 'react'
import { cn } from '@/utils'
import { StemType } from '@/components/studio/types'
import { TranscriptionSettings } from './TranscriptionSettings'
import { MIDIStatus } from './MIDIStatus'
import { AIEditor } from './AIEditor'
import { PianoRollViewer } from './PianoRollViewer'
import { midiEditorService, BasicPitchParams } from '@/services/midiEditorService'

interface TranscriptionPanelProps {
  stemType: string
  songId: string
  onClose: () => void
  onStemChange?: (stemType: StemType) => void
  availableStems?: StemType[]
  className?: string
}

export function TranscriptionPanel({
  stemType,
  songId,
  onClose,
  onStemChange,
  availableStems = [],
  className,
}: TranscriptionPanelProps) {
  // MIDI transcription state
  const [midiStatus, setMidiStatus] = useState<'none' | 'transcribing' | 'transcribed' | 'error'>('none')
  const [midiPath, setMidiPath] = useState<string | null>(null)
  const [notesDetected, setNotesDetected] = useState<number | null>(null)

  // Current stem (can be changed via dropdown)
  const [currentStem, setCurrentStem] = useState<string>(stemType)

  // Section selection for AI editing
  const [selectedSection, setSelectedSection] = useState<{ start: number; end: number } | null>(null)

  // Check MIDI status on mount and when stem changes
  useEffect(() => {
    checkMidiStatus()
  }, [songId, currentStem])

  // Check if MIDI file already exists
  const checkMidiStatus = async () => {
    try {
      const response = await midiEditorService.checkStatus({
        song_id: songId,
        stem_name: currentStem,
      })

      if (response.exists && response.status === 'transcribed') {
        setMidiStatus('transcribed')
        setMidiPath(response.midi_path || null)
        setNotesDetected(response.notes_detected || null)
      } else {
        setMidiStatus('none')
        setMidiPath(null)
        setNotesDetected(null)
      }
    } catch (error) {
      console.error('Failed to check MIDI status:', error)
      setMidiStatus('none')
    }
  }

  // Handle stem change from dropdown
  const handleStemChange = (newStem: string) => {
    setCurrentStem(newStem)
    // Clear section selection when changing stems
    setSelectedSection(null)
    // Notify parent if callback provided
    if (onStemChange) {
      onStemChange(newStem as StemType)
    }
    // Note: MIDI status will be updated by useEffect when currentStem changes
  }

  // Handle transcription
  const handleTranscribe = async (params: BasicPitchParams) => {
    setMidiStatus('transcribing')

    try {
      const response = await midiEditorService.transcribe({
        song_id: songId,
        stem_name: currentStem,
        params,
        force_retranscribe: midiStatus === 'transcribed', // Allow re-transcription
      })

      setMidiStatus('transcribed')
      setMidiPath(response.midi_path)
      setNotesDetected(response.notes_detected)

      // TODO: Show success toast
      console.log('Transcription successful:', response.message)
    } catch (error) {
      setMidiStatus('error')
      console.error('Transcription failed:', error)
      // TODO: Show error toast
    }
  }

  // Handle AI edit approval
  const handleApprove = async (sessionId: string) => {
    try {
      const response = await midiEditorService.approve({
        change_session_id: sessionId,
        approved: true,
      })

      console.log('Changes applied:', response.message)
      // TODO: Show success toast
      // TODO: Reload MIDI visualization if we add piano roll

    } catch (error) {
      console.error('Failed to apply changes:', error)
      throw error
    }
  }

  // Handle AI edit rejection
  const handleReject = async (sessionId: string) => {
    try {
      await midiEditorService.approve({
        change_session_id: sessionId,
        approved: false,
      })

      console.log('Changes rejected')
      setSelectedSection(null)
    } catch (error) {
      console.error('Failed to reject changes:', error)
    }
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-4">
        <div>
          <h3 className="font-display text-lg font-bold capitalize text-white">
            {currentStem} Transcription
          </h3>
          <p className="font-mono text-xs text-gray-500">AI-powered MIDI transcription & editing</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Transcription Settings */}
        <TranscriptionSettings
          songId={songId}
          stemName={currentStem}
          availableStems={availableStems}
          onStemChange={handleStemChange}
          onTranscribe={handleTranscribe}
          status={midiStatus}
        />

        {/* MIDI Status Display */}
        {midiStatus !== 'none' && (
          <MIDIStatus
            status={midiStatus}
            midiPath={midiPath || undefined}
            notesDetected={notesDetected || undefined}
          />
        )}

        {/* Piano Roll Viewer */}
        {midiStatus === 'transcribed' && midiPath && (
          <PianoRollViewer
            midiPath={midiPath}
            onSectionSelect={(start, end) => setSelectedSection({ start, end })}
            selectedSection={selectedSection}
          />
        )}

        {/* AI Editor (shows when section is selected OR always if transcribed) */}
        {midiStatus === 'transcribed' && (
          <AIEditor
            songId={songId}
            stemName={currentStem}
            section={selectedSection}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { cn } from '@/utils'
import { StemType } from '@/components/studio/types'
import { TranscriptionSettings } from './TranscriptionSettings'
import { MIDIStatus } from './MIDIStatus'
import { AIEditor } from './AIEditorWithChat'
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

      // Force reload the MIDI by updating the path with cache buster
      // This triggers PianoRollViewer to reload the updated MIDI file
      if (midiPath) {
        const url = new URL(midiPath, window.location.origin)
        url.searchParams.set('t', Date.now().toString())
        // Extract just the path + search params (without origin)
        setMidiPath(url.pathname + url.search)
      }

      // Clear selection after successful apply
      setSelectedSection(null)

      // TODO: Show success toast

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
    <div className={cn('flex h-full flex-col w-full relative overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-4 flex-shrink-0 relative z-10">
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

      {/* Content - Two Column Layout */}
      <div className="flex-1 grid grid-cols-[300px_1fr] gap-4 overflow-hidden p-4">
        {/* Left Column: Settings & Status */}
        <div className="flex flex-col gap-4 overflow-y-auto">
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
        </div>

        {/* Right Column: Piano Roll & AI Editor */}
        <div className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden min-w-0">
          {/* Piano Roll Viewer */}
          {midiStatus === 'transcribed' && midiPath && (
            <div className="min-w-0 max-w-full">
              <PianoRollViewer
                midiPath={midiPath}
                onSectionSelect={(start, end) => setSelectedSection({ start, end })}
                selectedSection={selectedSection}
              />
            </div>
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
    </div>
  )
}

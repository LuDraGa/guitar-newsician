import { useState, useEffect, useRef, useCallback } from 'react'
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

// Resize Handle Component
interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
}

function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="group relative w-1 flex-shrink-0 cursor-col-resize hover:bg-accent-500/30 transition-colors"
      onMouseDown={onMouseDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/5 group-hover:bg-accent-500/50" />
    </div>
  )
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

  // Column widths for resizable layout (percentages)
  const [settingsWidth, setSettingsWidth] = useState(20) // 20% for settings
  const [pianoRollWidth, setPianoRollWidth] = useState(52) // 52% for piano roll (majority)
  // AI width is calculated as: 100 - settingsWidth - pianoRollWidth - 0.5 (for handles)

  const containerRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef<'settings-piano' | 'piano-ai' | null>(null)

  // Handle resize start
  const handleResizeStart = useCallback((divider: 'settings-piano' | 'piano-ai') => (e: React.MouseEvent) => {
    e.preventDefault()

    if (!containerRef.current) return

    isResizingRef.current = divider
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      const percentX = (mouseX / containerWidth) * 100

      if (isResizingRef.current === 'settings-piano') {
        // Resize between settings and piano roll
        const newSettingsWidth = Math.max(15, Math.min(30, percentX)) // 15-30%
        setSettingsWidth(newSettingsWidth)
      } else if (isResizingRef.current === 'piano-ai') {
        // Resize between piano roll and AI
        // percentX represents the position from the left edge
        // Subtract settingsWidth to get the piano roll width
        const newPianoRollWidth = Math.max(30, Math.min(70, percentX - settingsWidth - 0.5)) // Keep piano roll 30-70%
        setPianoRollWidth(newPianoRollWidth)
      }
    }

    const handleMouseUp = () => {
      isResizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [settingsWidth])

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

      {/* Content - Three Column Resizable Layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden p-4 gap-0">
        {/* Column 1: Settings & Status */}
        <div
          className="flex flex-col gap-4 overflow-y-auto pr-2"
          style={{ width: `${settingsWidth}%` }}
        >
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

        {/* Resize Handle 1: Settings <-> Piano Roll */}
        <ResizeHandle onMouseDown={handleResizeStart('settings-piano')} />

        {/* Column 2: Piano Roll (Majority Width) */}
        <div
          className="flex flex-col overflow-y-auto overflow-x-hidden min-w-0 px-2"
          style={{ width: `${pianoRollWidth}%` }}
        >
          {midiStatus === 'transcribed' && midiPath && (
            <div className="min-w-0 max-w-full h-full">
              <PianoRollViewer
                midiPath={midiPath}
                onSectionSelect={(start, end) => setSelectedSection({ start, end })}
                selectedSection={selectedSection}
              />
            </div>
          )}
        </div>

        {/* Resize Handle 2: Piano Roll <-> AI Assistant */}
        <ResizeHandle onMouseDown={handleResizeStart('piano-ai')} />

        {/* Column 3: AI Assistant */}
        <div
          className="flex flex-col overflow-y-auto overflow-x-hidden min-w-0 pl-2"
          style={{ width: `${100 - settingsWidth - pianoRollWidth - 0.5}%` }}
        >
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

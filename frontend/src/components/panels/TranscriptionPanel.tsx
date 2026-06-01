import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/utils'
import { StemType } from '@/components/studio/types'
import { TranscriptionHeader } from './TranscriptionHeader'
import { MIDIStatus } from './MIDIStatus'
import { AIEditor } from './AIEditorWithChat'
import { PianoRollViewer } from './PianoRollViewer'
import { SheetMusicViewer } from './SheetMusicViewer'
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

  // View type for visualization (piano roll / sheet music / tablature)
  type ViewType = 'piano' | 'sheet' | 'tab'
  const [viewType, setViewType] = useState<ViewType>('piano')

  // Column widths for resizable layout (percentages)
  const [visualizationWidth, setVisualizationWidth] = useState(75) // 75% for visualization (piano/sheet/tab)
  // AI width is calculated as: 100 - visualizationWidth - 0.25 (for handle)

  const containerRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef<boolean>(false)

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    if (!containerRef.current) return

    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      const percentX = (mouseX / containerWidth) * 100

      // Resize between visualization and AI (60-85% range for visualization)
      const newVisualizationWidth = Math.max(60, Math.min(85, percentX))
      setVisualizationWidth(newVisualizationWidth)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

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
      {/* Compact Header */}
      <TranscriptionHeader
        songId={songId}
        stemName={currentStem}
        availableStems={availableStems}
        onStemChange={handleStemChange}
        onTranscribe={handleTranscribe}
        onClose={onClose}
        status={midiStatus}
        notesDetected={notesDetected || undefined}
      />

      {/* Content - Two Column Resizable Layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden p-4 gap-0">
        {/* Column 1: Visualization (Piano Roll / Sheet / Tab) - 75% default */}
        <div
          className="flex flex-col overflow-y-auto overflow-x-hidden min-w-0 pr-2"
          style={{ width: `${visualizationWidth}%` }}
        >
          {/* MIDI Status Display */}
          {midiStatus !== 'none' && (
            <div className="mb-3">
              <MIDIStatus
                status={midiStatus}
                midiPath={midiPath || undefined}
                notesDetected={notesDetected || undefined}
              />
            </div>
          )}

          {/* View Switcher Tabs */}
          {midiStatus === 'transcribed' && (
            <div className="mb-3 flex items-center gap-2 border-b border-white/5 pb-2">
              {/* Piano Roll Tab */}
              <button
                onClick={() => setViewType('piano')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-display text-sm font-semibold transition-all',
                  viewType === 'piano'
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'text-gray-400 border border-transparent hover:text-white hover:bg-white/5'
                )}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Piano Roll
              </button>

              {/* Sheet Music Tab */}
              <button
                onClick={() => setViewType('sheet')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-display text-sm font-semibold transition-all',
                  viewType === 'sheet'
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'text-gray-400 border border-transparent hover:text-white hover:bg-white/5'
                )}
                title="Sheet music view"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sheet Music
              </button>

              {/* Tablature Tab */}
              <button
                onClick={() => setViewType('tab')}
                disabled
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-display text-sm font-semibold transition-all',
                  viewType === 'tab'
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'text-gray-600 border border-transparent cursor-not-allowed opacity-50'
                )}
                title="Tablature view coming soon"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Tablature
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">Soon</span>
              </button>
            </div>
          )}

          {/* Visualization Area */}
          {midiStatus === 'transcribed' && midiPath && (
            <div className="min-w-0 max-w-full h-full">
              {viewType === 'piano' && (
                <PianoRollViewer
                  midiPath={midiPath}
                  onSectionSelect={(start, end) => setSelectedSection({ start, end })}
                  selectedSection={selectedSection}
                />
              )}
              {viewType === 'sheet' && (
                <SheetMusicViewer
                  songId={songId}
                  stemName={currentStem}
                  onSectionSelect={(start, end) => setSelectedSection({ start, end })}
                  selectedSection={selectedSection}
                />
              )}
              {viewType === 'tab' && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <svg className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 font-display text-sm text-gray-500">Tablature View</p>
                    <p className="mt-1 font-mono text-xs text-gray-600">Coming soon...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handle: Visualization <-> AI Assistant */}
        <ResizeHandle onMouseDown={handleResizeStart} />

        {/* Column 2: AI Assistant - 25% default */}
        <div
          className="flex flex-col overflow-y-auto overflow-x-hidden min-w-0 pl-2"
          style={{ width: `${100 - visualizationWidth - 0.25}%` }}
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

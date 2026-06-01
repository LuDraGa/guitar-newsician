/**
 * SheetMusicViewer Component
 * Renders MIDI as sheet music using VexFlow
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/utils'
import {
  initializeVexFlowRenderer,
  createStave,
  parseMusicXMLToVexFlow,
  renderNotesOnStave
} from '@/utils/vexflow'
import type { MusicXMLData } from '@/types/musicNotation'
import { midiEditorService } from '@/services/midiEditorService'

interface SheetMusicViewerProps {
  songId: string
  stemName: string
  onSectionSelect?: (start: number, end: number) => void
  selectedSection?: { start: number; end: number } | null
}

export function SheetMusicViewer({
  songId,
  stemName,
  onSectionSelect,
  selectedSection
}: SheetMusicViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [musicXMLData, setMusicXMLData] = useState<MusicXMLData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(0)
  const [measuresPerLine, setMeasuresPerLine] = useState(4)
  const [linesPerPage, setLinesPerPage] = useState(4)
  const measuresPerPage = measuresPerLine * linesPerPage

  // Track what we've loaded to avoid re-converting
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // Load MusicXML from backend (only once per songId+stemName combination)
  useEffect(() => {
    const cacheKey = `${songId}:${stemName}`
    if (loadedKey !== cacheKey) {
      loadMusicXML()
    }
  }, [songId, stemName, loadedKey])

  const loadMusicXML = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Converting MIDI to MusicXML:', { songId, stemName })

      const response = await midiEditorService.convertToMusicXML({
        song_id: songId,
        stem_name: stemName
      })
      setMusicXMLData(response)
      setLoadedKey(`${songId}:${stemName}`) // Mark as loaded
      setLoading(false)
    } catch (err) {
      console.error('Failed to load MusicXML:', err)
      setError(err instanceof Error ? err.message : 'Failed to convert MIDI to sheet music')
      setLoading(false)
    }
  }

  // Render sheet music when data changes
  useEffect(() => {
    if (!musicXMLData || !canvasRef.current) return

    renderSheetMusic()
  }, [musicXMLData, currentPage, measuresPerPage])

  // Add resize observer for dynamic resizing (debounced)
  useEffect(() => {
    if (!containerRef.current) return

    let resizeTimer: NodeJS.Timeout

    const resizeObserver = new ResizeObserver(() => {
      if (musicXMLData) {
        // Debounce resize to avoid rapid re-renders
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          renderSheetMusic()
        }, 150) // Wait 150ms after last resize
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      clearTimeout(resizeTimer)
      resizeObserver.disconnect()
    }
  }, [musicXMLData, currentPage, measuresPerPage])

  const renderSheetMusic = () => {
    if (!canvasRef.current || !musicXMLData) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!container) return

    // Resize canvas to container
    const width = container.clientWidth - 40 // Account for padding
    const staveHeight = 120 // Height of each staff line
    const linesPerPageCalc = linesPerPage
    const height = staveHeight * linesPerPageCalc + 100 // Top margin + lines

    canvas.width = width + 40 // Add back padding for canvas
    canvas.height = height

    // Fill canvas with dark background
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#1a1a1a' // Dark background for notation
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    try {
      // Initialize VexFlow
      const { context } = initializeVexFlowRenderer(canvas, {
        width: canvas.width,
        height: canvas.height,
        clef: 'treble'
      })

      // Parse MusicXML to VexFlow format
      const measures = parseMusicXMLToVexFlow(musicXMLData.musicxml)

      if (measures.length === 0) {
        console.warn('No measures found in MusicXML')
        return
      }

      // Calculate which measures to display on current page
      const startMeasure = currentPage * measuresPerPage
      const endMeasure = Math.min(startMeasure + measuresPerPage, measures.length)
      const visibleMeasures = measures.slice(startMeasure, endMeasure)

      // Calculate dimensions
      const staveWidth = width / measuresPerLine
      const leftMargin = 20

      // Render measures in lines
      let measureIdx = 0
      for (let line = 0; line < linesPerPageCalc && measureIdx < visibleMeasures.length; line++) {
        const yOffset = 60 + line * staveHeight

        for (let col = 0; col < measuresPerLine && measureIdx < visibleMeasures.length; col++) {
          const measureNotes = visibleMeasures[measureIdx]
          const globalMeasureNumber = startMeasure + measureIdx
          const xOffset = leftMargin + col * staveWidth

          // Determine what to show on this measure
          const isFirstMeasureOfPage = measureIdx === 0  // Very first measure of page
          const isFirstMeasureOfLine = col === 0  // First measure of each line

          // Create stave for this measure
          const stave = createStave(
            context,
            xOffset,
            yOffset,
            staveWidth,
            isFirstMeasureOfLine ? 'treble' : undefined,  // Only show clef at start of each line
            isFirstMeasureOfPage ? musicXMLData.key : undefined,  // Only show key sig on very first measure
            isFirstMeasureOfPage ? musicXMLData.time_signature : undefined  // Only show time sig on very first measure
          )

          // Render notes on stave
          if (measureNotes.length > 0) {
            try {
              renderNotesOnStave(context, stave, measureNotes, musicXMLData.time_signature)
            } catch (err) {
              console.error(`Failed to render measure ${globalMeasureNumber}:`, err)
            }
          }

          measureIdx++
        }
      }
    } catch (err) {
      console.error('Failed to render sheet music:', err)
      setError('Failed to render sheet music notation')
    }
  }

  // Handle canvas click for section selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // TODO: Implement measure selection for AI editing
    // Will need to map click coordinates to measure numbers
    console.log('Sheet music clicked:', e.clientX, e.clientY)
  }, [])

  // Pagination controls
  const totalPages = musicXMLData ? Math.ceil(musicXMLData.measures / measuresPerPage) : 0

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent" />
          <p className="mt-4 font-display text-sm text-gray-400">Converting to sheet music...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-4 font-display text-sm text-red-400">{error}</p>
          <button
            onClick={loadMusicXML}
            className="mt-4 rounded-lg bg-accent-500/20 px-4 py-2 font-display text-sm font-semibold text-accent-400 transition-all hover:bg-accent-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Sheet Music Info Bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-4 font-mono text-xs text-gray-400">
          <span>Key: {musicXMLData?.key}</span>
          <span>Time: {musicXMLData?.time_signature}</span>
          {musicXMLData?.tempo && <span>Tempo: {musicXMLData.tempo} BPM</span>}
          <span>Measures: {musicXMLData?.measures}</span>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 0}
              className="rounded-lg border border-white/10 bg-dark-400/50 px-3 py-1 font-mono text-xs text-gray-400 transition-all hover:border-accent-500/30 hover:bg-dark-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="font-mono text-xs text-gray-400">
              Page {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="rounded-lg border border-white/10 bg-dark-400/50 px-3 py-1 font-mono text-xs text-gray-400 transition-all hover:border-accent-500/30 hover:bg-dark-400/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Canvas for VexFlow rendering */}
      <div className="flex-1 overflow-auto p-4 bg-dark-500/20">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-pointer rounded-lg shadow-lg"
          style={{ backgroundColor: '#1a1a1a' }}
        />
      </div>
    </div>
  )
}

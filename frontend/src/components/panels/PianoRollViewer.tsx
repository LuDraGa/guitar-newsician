/**
 * PianoRollViewer Component
 * Interactive piano roll visualization with MIDI playback and section selection
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Square, ZoomIn, ZoomOut, Music2, Navigation, Eye } from 'lucide-react'
import * as Tone from 'tone'
import { parseMIDIFile, MIDINote, MIDIParsedData, getNoteColor } from '@/utils/midiParser'
import { cn } from '@/utils'

interface PianoRollViewerProps {
  midiPath: string
  onSectionSelect?: (start: number, end: number) => void
  selectedSection?: { start: number; end: number } | null
  className?: string
}

export function PianoRollViewer({
  midiPath,
  onSectionSelect,
  selectedSection,
  className,
}: PianoRollViewerProps) {
  const pianoKeysCanvasRef = useRef<HTMLCanvasElement>(null) // Fixed left: piano keys
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null) // Scrollable right: grid + notes
  const containerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [midiData, setMidiData] = useState<MIDIParsedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const synthRef = useRef<Tone.PolySynth | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playbackStartTimeRef = useRef<number>(0)

  // View state
  const [zoom, setZoom] = useState(1)
  const [scrollX, setScrollX] = useState(0)
  const [containerWidth, setContainerWidth] = useState(800)
  const [autoFollow, setAutoFollow] = useState(true)
  const isManualScrollingRef = useRef(false)

  // Selection state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; time: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; time: number } | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)

  // Constants for rendering
  const PIXELS_PER_SECOND = 100 * zoom
  const NOTE_HEIGHT = 8
  const PIANO_KEY_WIDTH = 60
  const CANVAS_HEIGHT = 420

  // Calculate total timeline width based on MIDI duration and zoom
  const totalWidth = midiData ? (midiData.duration * PIXELS_PER_SECOND) + 100 : 0

  // Load MIDI file
  useEffect(() => {
    loadMIDI()
  }, [midiPath])

  // Cleanup on unmount - stop playback and cancel scheduled notes
  useEffect(() => {
    return () => {
      // Stop playback
      setIsPlaying(false)

      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Stop and cancel all Tone.js events
      Tone.Transport.stop()
      Tone.Transport.cancel()

      // Release all notes
      if (synthRef.current) {
        synthRef.current.releaseAll()
      }
    }
  }, [])

  // Track container width for responsive canvas (scrollable timeline area only)
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        // Get the scrollable container width (excludes piano keys)
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Track shift key state for cursor feedback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Handle scroll events - detect manual scrolling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      setScrollX(container.scrollLeft)

      // Detect manual scrolling (user-initiated)
      if (isManualScrollingRef.current) {
        // This scroll was programmatic, ignore
        isManualScrollingRef.current = false
      } else {
        // This was user-initiated, disable auto-follow
        if (autoFollow && isPlaying) {
          setAutoFollow(false)
        }
      }

      // Clear the manual scrolling flag after a short delay
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isManualScrollingRef.current = false
      }, 100)
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [autoFollow, isPlaying])

  // Smart auto-follow: keep cursor at 25% from left edge
  useEffect(() => {
    if (!autoFollow || !isPlaying || !containerRef.current || !midiData) return

    const cursorX = currentTime * PIXELS_PER_SECOND
    const targetCursorPosition = containerWidth * 0.25 // 25% from left of scrollable area
    const targetScrollLeft = Math.max(0, cursorX - targetCursorPosition)

    // Mark this as programmatic scroll
    isManualScrollingRef.current = true
    containerRef.current.scrollLeft = targetScrollLeft
  }, [currentTime, autoFollow, isPlaying, midiData, containerWidth, zoom])

  // Re-enable auto-follow when playback starts
  useEffect(() => {
    if (isPlaying) {
      setAutoFollow(true)
    }
  }, [isPlaying])

  const loadMIDI = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await parseMIDIFile(midiPath)
      setMidiData(data)

      // Initialize Tone.js synth
      if (!synthRef.current) {
        synthRef.current = new Tone.PolySynth(Tone.Synth, {
          envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.3,
            release: 0.8,
          },
        }).toDestination()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MIDI')
    } finally {
      setLoading(false)
    }
  }

  // Draw piano keys (fixed left panel) - only when data changes
  useEffect(() => {
    if (!pianoKeysCanvasRef.current || !midiData) return

    const canvas = pianoKeysCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const height = CANVAS_HEIGHT
    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    canvas.width = PIANO_KEY_WIDTH * dpr
    canvas.height = height * dpr
    canvas.style.width = `${PIANO_KEY_WIDTH}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, PIANO_KEY_WIDTH, height)

    // Calculate pitch range
    const pitches = midiData.notes.map(n => n.pitch)
    const minPitch = Math.min(...pitches) - 2
    const maxPitch = Math.max(...pitches) + 2
    const pitchRange = maxPitch - minPitch

    // Draw piano keys
    for (let p = minPitch; p <= maxPitch; p++) {
      const y = height - ((p - minPitch) / pitchRange) * height

      // Piano key background
      const isBlackKey = [1, 3, 6, 8, 10].includes(p % 12)
      ctx.fillStyle = isBlackKey ? '#1a1a1a' : '#0f0f0f'
      ctx.fillRect(0, y - NOTE_HEIGHT / 2, PIANO_KEY_WIDTH, NOTE_HEIGHT)

      // Key border
      ctx.strokeStyle = '#2a2a2a'
      ctx.strokeRect(0, y - NOTE_HEIGHT / 2, PIANO_KEY_WIDTH, NOTE_HEIGHT)

      // Note name
      const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][p % 12]
      const octave = Math.floor(p / 12) - 1
      ctx.fillStyle = isBlackKey ? '#666' : '#888'
      ctx.font = '9px monospace'
      ctx.fillText(`${noteName}${octave}`, 5, y + 3)
    }

    // Right border
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PIANO_KEY_WIDTH - 1, 0)
    ctx.lineTo(PIANO_KEY_WIDTH - 1, height)
    ctx.stroke()
  }, [midiData])

  // Draw timeline (scrollable right panel) - when zoom/data/selection changes
  useEffect(() => {
    if (!timelineCanvasRef.current || !midiData) return

    const canvas = timelineCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate canvas width based on MIDI duration + padding (no PIANO_KEY_WIDTH offset)
    const totalWidth = (midiData.duration * PIXELS_PER_SECOND) + 100
    const height = CANVAS_HEIGHT

    // Set canvas size
    const dpr = window.devicePixelRatio || 1
    canvas.width = totalWidth * dpr
    canvas.height = height * dpr
    canvas.style.width = `${totalWidth}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, totalWidth, height)

    // Calculate pitch range
    const pitches = midiData.notes.map(n => n.pitch)
    const minPitch = Math.min(...pitches) - 2
    const maxPitch = Math.max(...pitches) + 2
    const pitchRange = maxPitch - minPitch

    // Draw grid lines (time)
    ctx.strokeStyle = '#1f1f1f'
    ctx.lineWidth = 1
    for (let t = 0; t <= midiData.duration; t += 1) {
      const x = t * PIXELS_PER_SECOND
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      // Time labels
      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      ctx.fillText(`${t}s`, x + 2, 12)
    }

    // Draw horizontal grid lines
    for (let p = minPitch; p <= maxPitch; p++) {
      const y = height - ((p - minPitch) / pitchRange) * height

      // Grid line
      ctx.strokeStyle = '#1a1a1a'
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(totalWidth, y)
      ctx.stroke()
    }

    // Draw selected section overlay
    if (selectedSection) {
      const startX = selectedSection.start * PIXELS_PER_SECOND
      const endX = selectedSection.end * PIXELS_PER_SECOND
      const sectionWidth = endX - startX

      ctx.fillStyle = 'rgba(255, 200, 0, 0.1)'
      ctx.fillRect(startX, 0, sectionWidth, height)

      ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)'
      ctx.lineWidth = 2
      ctx.strokeRect(startX, 0, sectionWidth, height)
    }

    // Draw MIDI notes
    midiData.notes.forEach(note => {
      const x = note.time * PIXELS_PER_SECOND
      const noteWidth = note.duration * PIXELS_PER_SECOND
      const y = height - ((note.pitch - minPitch) / pitchRange) * height

      // Note rectangle
      ctx.fillStyle = getNoteColor(note.pitch)
      ctx.globalAlpha = 0.3 + note.velocity * 0.5
      ctx.fillRect(x, y - NOTE_HEIGHT / 2, noteWidth, NOTE_HEIGHT)

      // Note border
      ctx.strokeStyle = getNoteColor(note.pitch)
      ctx.globalAlpha = 1
      ctx.lineWidth = 1
      ctx.strokeRect(x, y - NOTE_HEIGHT / 2, noteWidth, NOTE_HEIGHT)
    })
  }, [midiData, zoom, selectedSection])

  // Update cursor position via CSS (no canvas redraw!)
  useEffect(() => {
    if (!cursorRef.current || !midiData) return

    const cursorX = currentTime * PIXELS_PER_SECOND // No PIANO_KEY_WIDTH offset
    cursorRef.current.style.transform = `translateX(${cursorX}px)`
    cursorRef.current.style.display = (isPlaying || currentTime > 0) ? 'block' : 'none'
  }, [currentTime, isPlaying, midiData, zoom])

  // Playback loop - throttled to 20fps for smooth performance
  useEffect(() => {
    if (!isPlaying || !midiData) {
      // Cancel animation frame if stopped
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    playbackStartTimeRef.current = Tone.now()
    let lastUpdateTime = 0
    const updateInterval = 1000 / 20 // 20fps - smooth enough, way less CPU

    const updatePlayback = (timestamp: number) => {
      // Throttle updates to 20fps
      if (timestamp - lastUpdateTime < updateInterval) {
        animationFrameRef.current = requestAnimationFrame(updatePlayback)
        return
      }
      lastUpdateTime = timestamp

      const elapsed = Tone.now() - playbackStartTimeRef.current
      const newTime = currentTime + elapsed

      if (newTime >= midiData.duration) {
        handleStop()
        return
      }

      setCurrentTime(newTime)
      animationFrameRef.current = requestAnimationFrame(updatePlayback)
    }

    animationFrameRef.current = requestAnimationFrame(updatePlayback)

    // Cleanup on unmount or when playback stops
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isPlaying])

  // Handle play/pause
  const handlePlay = async () => {
    if (!midiData || !synthRef.current) return

    await Tone.start()

    // Cancel any existing scheduled events first
    Tone.Transport.cancel()

    // Schedule all notes using Transport for better control
    midiData.notes.forEach(note => {
      if (note.time >= currentTime) {
        const timeOffset = note.time - currentTime
        Tone.Transport.schedule((time) => {
          synthRef.current!.triggerAttackRelease(
            note.pitchName,
            note.duration,
            time,
            note.velocity
          )
        }, `+${timeOffset}`)
      }
    })

    // Start transport
    Tone.Transport.start()
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)

    // Stop all currently playing notes
    if (synthRef.current) {
      synthRef.current.releaseAll()
    }

    // Stop and cancel Transport
    Tone.Transport.stop()
    Tone.Transport.cancel()

    // Cancel animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  const handleStop = () => {
    setIsPlaying(false)
    setCurrentTime(0)

    // Stop all currently playing notes
    if (synthRef.current) {
      synthRef.current.releaseAll()
    }

    // Cancel any scheduled events
    Tone.Transport.stop()
    Tone.Transport.cancel()

    // Cancel animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  // Handle mouse events for selection (on timeline canvas overlay)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || !midiData) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = x / PIXELS_PER_SECOND

    // Shift + drag = select region for AI editing
    if (e.shiftKey) {
      setIsDragging(true)
      setDragStart({ x, time })
      setDragCurrent({ x, time })
    } else {
      // Regular click = seek to position
      setCurrentTime(time)
      // Stop playback on seek (common DAW behavior)
      if (isPlaying) {
        handlePause()
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = x / PIXELS_PER_SECOND

    setDragCurrent({ x, time })
  }

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent || !onSectionSelect) {
      setIsDragging(false)
      setDragStart(null)
      setDragCurrent(null)
      return
    }

    const startTime = Math.max(0, Math.min(dragStart.time, dragCurrent.time))
    const endTime = Math.max(dragStart.time, dragCurrent.time)

    if (endTime - startTime > 0.1) { // Minimum 0.1s selection
      onSectionSelect(startTime, endTime)
    }

    setIsDragging(false)
    setDragStart(null)
    setDragCurrent(null)
  }

  // Zoom controls
  const handleZoomIn = () => setZoom(Math.min(zoom * 1.5, 4))
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.5, 0.25))

  // Auto-follow controls
  const handleToggleAutoFollow = () => {
    setAutoFollow(!autoFollow)
  }

  const handleJumpToPlayhead = () => {
    if (!containerRef.current || !midiData) return

    const cursorX = currentTime * PIXELS_PER_SECOND
    const targetCursorPosition = containerWidth * 0.25
    const targetScrollLeft = Math.max(0, cursorX - targetCursorPosition)

    // Jump to playhead without changing auto-follow state
    isManualScrollingRef.current = true
    containerRef.current.scrollLeft = targetScrollLeft
    // Note: Don't call setAutoFollow(true) - respect user's choice
  }

  // Check if cursor is visible in viewport
  const isCursorVisible = () => {
    if (!midiData) return true
    const cursorX = currentTime * PIXELS_PER_SECOND
    const viewportLeft = scrollX
    const viewportRight = scrollX + containerWidth
    return cursorX >= viewportLeft && cursorX <= viewportRight
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center rounded-xl border border-white/10 bg-dark-300/30 p-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
            <p className="mt-3 font-mono text-sm text-gray-400">Loading MIDI...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !midiData) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="font-mono text-sm text-red-400">{error || 'Failed to load MIDI'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full relative', className)}>
      <style>{`
        .piano-roll-container::-webkit-scrollbar {
          height: 12px;
        }
        .piano-roll-container::-webkit-scrollbar-track {
          background: #111;
          border-radius: 6px;
        }
        .piano-roll-container::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 6px;
          border: 2px solid #111;
        }
        .piano-roll-container::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>
      <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4 w-full relative overflow-hidden">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-accent-400" />
            <h4 className="font-display text-sm font-semibold text-white">Piano Roll</h4>
            <span className="font-mono text-xs text-gray-500">
              {midiData.notes.length} notes • {midiData.duration.toFixed(1)}s
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <button
              onClick={handleZoomOut}
              className="rounded-lg bg-dark-400/50 p-1.5 text-gray-400 transition-colors hover:bg-dark-400 hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-xs text-gray-500">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={handleZoomIn}
              className="rounded-lg bg-dark-400/50 p-1.5 text-gray-400 transition-colors hover:bg-dark-400 hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <div className="mx-2 h-4 w-px bg-white/10" />

            {/* Playback */}
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="rounded-lg bg-accent-500/20 p-1.5 text-accent-400 transition-colors hover:bg-accent-500/30"
                title="Play"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="rounded-lg bg-accent-500/20 p-1.5 text-accent-400 transition-colors hover:bg-accent-500/30"
                title="Pause"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={handleStop}
              className="rounded-lg bg-dark-400/50 p-1.5 text-gray-400 transition-colors hover:bg-dark-400 hover:text-white"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>

            <div className="mx-2 h-4 w-px bg-white/10" />

            {/* Auto-follow controls */}
            <button
              onClick={handleToggleAutoFollow}
              className={`rounded-lg p-1.5 transition-colors ${
                autoFollow
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-dark-400/50 text-gray-400 hover:bg-dark-400 hover:text-white'
              }`}
              title={autoFollow ? 'Auto-follow enabled' : 'Auto-follow disabled'}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* Jump to playhead - always show when auto-follow disabled, or when cursor off-screen */}
            {(isPlaying || currentTime > 0) && (!autoFollow || !isCursorVisible()) && (
              <button
                onClick={handleJumpToPlayhead}
                className={`rounded-lg bg-blue-500/20 p-1.5 text-blue-400 transition-colors hover:bg-blue-500/30 ${
                  !isCursorVisible() ? 'animate-pulse' : ''
                }`}
                title="Jump to playhead"
              >
                <Navigation className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Canvas - Two-panel layout: fixed piano keys + scrollable timeline */}
        <div className="flex rounded-lg border border-white/5 bg-black overflow-hidden w-full max-w-full relative isolate">
          {/* Left: Fixed piano keys */}
          <div className="flex-shrink-0 relative">
            <canvas ref={pianoKeysCanvasRef} className="block" />
          </div>

          {/* Right: Scrollable timeline */}
          <div
            ref={containerRef}
            className="relative overflow-x-auto overflow-y-hidden piano-roll-container flex-1 min-w-0"
            style={{ maxHeight: CANVAS_HEIGHT }}
          >
            <div className="relative"
              style={{ height: CANVAS_HEIGHT, width: totalWidth }}
            >
              {/* Timeline canvas - rendered once on zoom/data changes */}
              <canvas ref={timelineCanvasRef} className="block" />

              {/* Playback cursor - CSS positioned div, no canvas redraw! */}
              <div
                ref={cursorRef}
                className="absolute top-0 pointer-events-none"
                style={{
                  width: '2px',
                  height: CANVAS_HEIGHT,
                  backgroundColor: '#00ff00',
                  display: 'none',
                  willChange: 'transform',
                }}
              />

              {/* Drag selection overlay - CSS positioned div */}
              {isDragging && dragStart && dragCurrent && (
                <div
                  className="absolute top-0 pointer-events-none"
                  style={{
                    left: Math.min(dragStart.x, dragCurrent.x),
                    width: Math.abs(dragCurrent.x - dragStart.x),
                    height: CANVAS_HEIGHT,
                    backgroundColor: 'rgba(100, 150, 255, 0.2)',
                    border: '2px dashed rgba(100, 150, 255, 0.8)',
                  }}
                />
              )}

              {/* Invisible interaction layer for mouse events */}
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={cn("absolute top-0 left-0", isShiftPressed ? "cursor-crosshair" : "cursor-pointer")}
                style={{ height: CANVAS_HEIGHT, width: totalWidth }}
              />
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[10px] text-gray-600">
            Click to seek • <span className={isShiftPressed ? "text-accent-400 font-semibold" : ""}>Shift + drag to select region for AI editing</span>
          </p>
          <div className="flex items-center gap-3">
            {isShiftPressed && (
              <span className="font-mono text-[10px] text-accent-400 font-semibold">
                ⇧ Selection mode active
              </span>
            )}
            {autoFollow && isPlaying && (
              <p className="font-mono text-[10px] text-green-400">
                ● Auto-following playback
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

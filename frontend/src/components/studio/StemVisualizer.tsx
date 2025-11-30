import { cn } from '@/utils'
import { VisualizerView, OverlayType, StemType, StemState } from './types'
import { useState } from 'react'

interface StemVisualizerProps {
  stems: StemState[]
  view: VisualizerView
  overlays: Set<OverlayType>
  currentTime: number
  duration: number
  loopStart: number | null
  loopEnd: number | null
  onViewChange: (view: VisualizerView) => void
  onOverlayToggle: (overlay: OverlayType) => void
  onSeek: (time: number) => void
  onStemClick?: (type: StemType) => void
  className?: string
}

const stemColors: Record<StemType, string> = {
  vocals: 'bg-blue-500',
  drums: 'bg-red-500',
  bass: 'bg-purple-500',
  guitar: 'bg-yellow-500',
  piano: 'bg-green-500',
  other: 'bg-gray-500',
}

export function StemVisualizer({
  stems,
  view,
  overlays,
  currentTime,
  duration,
  loopStart,
  loopEnd,
  onViewChange,
  onOverlayToggle,
  onSeek,
  onStemClick,
  className,
}: StemVisualizerProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false)

  // Calculate playhead position as percentage
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0
  const loopStartPosition = loopStart !== null && duration > 0 ? (loopStart / duration) * 100 : null
  const loopEndPosition = loopEnd !== null && duration > 0 ? (loopEnd / duration) * 100 : null

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const seekTime = percentage * duration
    onSeek(seekTime)
  }

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
      {/* Controls Bar */}
      <div className="flex items-center justify-between">
        {/* View Selector */}
        <div className="relative">
          <button
            onClick={() => setViewMenuOpen(!viewMenuOpen)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-dark-300/50 px-3 py-1.5 font-sans text-xs text-gray-300 transition-all hover:border-accent-500/30 hover:bg-accent-500/10"
          >
            <span className="font-semibold">View:</span>
            <span className="capitalize">{view}</span>
            <svg
              className={cn('h-3 w-3 transition-transform', viewMenuOpen && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* View Dropdown */}
          {viewMenuOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-dark-300/95 backdrop-blur-xl shadow-xl">
              {(['waveform', 'spectrogram', 'equalizer'] as VisualizerView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    onViewChange(v)
                    setViewMenuOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 font-sans text-xs capitalize transition-colors first:rounded-t-lg last:rounded-b-lg',
                    view === v
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-300 hover:bg-accent-500/10 hover:text-accent-400'
                  )}
                >
                  {view === v && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overlay Toggles */}
        <div className="flex items-center gap-2">
          <span className="mr-1 font-sans text-xs font-semibold text-gray-400">Overlays:</span>
          {(['beats', 'chords', 'sections'] as OverlayType[]).map((overlay) => (
            <button
              key={overlay}
              onClick={() => onOverlayToggle(overlay)}
              className={cn(
                'rounded border px-2 py-1 font-sans text-xs capitalize transition-all',
                overlays.has(overlay)
                  ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                  : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10'
              )}
            >
              {overlay}
            </button>
          ))}
        </div>
      </div>

      {/* Visualizer Grid */}
      <div
        className="relative min-h-[300px] cursor-crosshair overflow-hidden rounded-lg border border-white/5 bg-dark-500/50"
        onClick={handleClick}
      >
        {/* Grid Layout - 2x3 for 6 stems */}
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-px bg-white/5">
          {stems.map((stem) => (
            <div
              key={stem.type}
              className={cn(
                'group relative flex items-center justify-center bg-dark-500/50 transition-all',
                stem.muted && 'opacity-30',
                stem.solo && 'ring-2 ring-yellow-500/50',
                onStemClick && 'cursor-pointer hover:bg-dark-400/70'
              )}
              onClick={(e) => {
                if (onStemClick) {
                  e.stopPropagation()
                  onStemClick(stem.type)
                }
              }}
            >
              {/* Stem Label */}
              <div className="absolute left-2 top-2 z-10 rounded bg-dark-500/80 px-2 py-1 font-sans text-xs font-semibold capitalize text-white">
                {stem.type}
              </div>

              {/* Placeholder Waveform */}
              <div className="h-full w-full p-4">
                {view === 'waveform' && (
                  <svg className="h-full w-full opacity-50" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d={`M 0,20 ${Array.from({ length: 50 }, (_, i) => {
                        const x = i * 2
                        const amplitude = Math.sin(i * 0.3) * 15 * stem.volume
                        return `L ${x},${20 + amplitude}`
                      }).join(' ')}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className={cn(stemColors[stem.type].replace('bg-', 'text-'))}
                    />
                  </svg>
                )}

                {view === 'spectrogram' && (
                  <div className="grid h-full grid-cols-20 gap-px">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div
                        key={i}
                        className={cn('rounded-sm', stemColors[stem.type])}
                        style={{ opacity: Math.random() * stem.volume }}
                      />
                    ))}
                  </div>
                )}

                {view === 'equalizer' && (
                  <div className="flex h-full items-end justify-around gap-1">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className={cn('w-full rounded-t', stemColors[stem.type])}
                        style={{ height: `${Math.random() * 80 * stem.volume}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Hover Hint */}
              {onStemClick && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-500/0 opacity-0 transition-all group-hover:bg-dark-500/80 group-hover:opacity-100">
                  <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 px-3 py-2 font-sans text-xs text-accent-400">
                    Click to transcribe
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-accent-500 shadow-lg shadow-accent-500/50"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-accent-500 shadow-lg shadow-accent-500/50" />
        </div>

        {/* Loop Markers */}
        {loopStartPosition !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-green-500/70"
            style={{ left: `${loopStartPosition}%` }}
          >
            <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-green-500" />
            <div className="absolute top-1 left-2 rounded bg-green-500/80 px-1.5 py-0.5 font-mono text-xs text-white">
              A
            </div>
          </div>
        )}
        {loopEndPosition !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500/70"
            style={{ left: `${loopEndPosition}%` }}
          >
            <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-red-500" />
            <div className="absolute top-1 left-2 rounded bg-red-500/80 px-1.5 py-0.5 font-mono text-xs text-white">
              B
            </div>
          </div>
        )}

        {/* Loop Region Highlight */}
        {loopStartPosition !== null && loopEndPosition !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 bg-accent-500/10"
            style={{
              left: `${loopStartPosition}%`,
              width: `${loopEndPosition - loopStartPosition}%`,
            }}
          />
        )}

        {/* Overlay Indicators (Placeholder) */}
        {overlays.has('beats') && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        )}
        {overlays.has('chords') && (
          <div className="pointer-events-none absolute inset-x-0 top-2 h-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        )}
        {overlays.has('sections') && (
          <div className="pointer-events-none absolute inset-x-0 top-4 h-1 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
        )}
      </div>

      {/* Info */}
      <div className="flex items-center justify-between font-mono text-xs text-gray-500">
        <span>Click visualizer to open transcription for any stem</span>
        <span>
          {view === 'waveform' && 'Waveform View'}
          {view === 'spectrogram' && 'Spectrogram View'}
          {view === 'equalizer' && 'Equalizer View'}
        </span>
      </div>
    </div>
  )
}

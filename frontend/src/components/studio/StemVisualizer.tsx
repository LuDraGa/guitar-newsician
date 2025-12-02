import { cn } from '@/utils'
import { VisualizerView, OverlayType, StemType, StemState } from './types'
import { useState, useEffect } from 'react'
import { WaveformCanvas } from './visualizers/WaveformCanvas'
import { SpectrogramCanvas } from './visualizers/SpectrogramCanvas'
import { AnalysisOverlays } from './visualizers/AnalysisOverlays'
import { libraryApi } from '@/services/api'

interface StemVisualizerProps {
  stems: StemState[]
  view: VisualizerView
  overlays: Set<OverlayType>
  currentTime: number
  duration: number
  loopStart: number | null
  loopEnd: number | null
  analysisData: any | null
  songId: string
  onViewChange: (view: VisualizerView) => void
  onOverlayToggle: (overlay: OverlayType) => void
  onSeek: (time: number) => void
  className?: string
}

const stemColors: Record<StemType, string> = {
  vocals: '#3b82f6', // blue
  drums: '#ef4444',   // red
  bass: '#a855f7',    // purple
  guitar: '#eab308',  // yellow
  piano: '#22c55e',   // green
  other: '#6b7280',   // gray
}

const STEM_HEIGHT = 90 // Height of each stem visualization (reduced for 13" screens)

export function StemVisualizer({
  stems,
  view,
  overlays,
  currentTime,
  duration,
  loopStart,
  loopEnd,
  analysisData,
  songId,
  onViewChange,
  onOverlayToggle,
  onSeek,
  className,
}: StemVisualizerProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [stemUrls, setStemUrls] = useState<Record<StemType, string>>({} as Record<StemType, string>)
  const [containerWidth, setContainerWidth] = useState(0)

  // Calculate playhead position as percentage
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0
  const loopStartPosition = loopStart !== null && duration > 0 ? (loopStart / duration) * 100 : null
  const loopEndPosition = loopEnd !== null && duration > 0 ? (loopEnd / duration) * 100 : null

  // Load stem URLs
  useEffect(() => {
    async function loadStemUrls() {
      const urls: Partial<Record<StemType, string>> = {}

      for (const stem of stems) {
        try {
          const url = await libraryApi.getStemUrl(songId, stem.type)
          urls[stem.type] = url
        } catch (error) {
          console.error(`[StemVisualizer] Failed to get URL for ${stem.type}:`, error)
        }
      }

      setStemUrls(urls as Record<StemType, string>)
    }

    if (songId && stems.length > 0) {
      loadStemUrls()
    }
  }, [songId, stems])

  // Measure container width for responsive rendering
  useEffect(() => {
    const measureWidth = () => {
      const container = document.getElementById('stem-visualizer-container')
      if (container) {
        setContainerWidth(container.clientWidth)
      }
    }

    measureWidth()
    window.addEventListener('resize', measureWidth)
    return () => window.removeEventListener('resize', measureWidth)
  }, [])

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
              {(['waveform', 'spectrogram'] as VisualizerView[]).map((v) => (
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

      {/* Visualizer - Vertical Stacking */}
      <div
        id="stem-visualizer-container"
        className="relative min-h-[400px] cursor-crosshair overflow-hidden rounded-lg border border-white/5 bg-dark-500/50"
        onClick={handleClick}
      >
        {/* Stem Tracks - Stacked Vertically */}
        <div className="relative" style={{ height: stems.length * STEM_HEIGHT }}>
          {stems.map((stem, index) => {
            const stemUrl = stemUrls[stem.type]
            const yOffset = index * STEM_HEIGHT

            return (
              <div
                key={stem.type}
                className={cn(
                  'absolute left-0 right-0 border-b border-white/5 bg-dark-500/50 transition-all',
                  stem.muted && 'opacity-30',
                  stem.solo && 'ring-2 ring-yellow-500/50 ring-inset'
                )}
                style={{
                  top: yOffset,
                  height: STEM_HEIGHT,
                }}
              >
                {/* Stem Label */}
                <div className="absolute left-3 top-3 z-20 rounded bg-dark-500/90 px-2 py-1 font-sans text-xs font-semibold capitalize shadow-lg"
                     style={{ color: stemColors[stem.type] }}>
                  {stem.type}
                </div>

                {/* Waveform Visualization */}
                {view === 'waveform' && stemUrl && containerWidth > 0 && (
                  <WaveformCanvas
                    audioUrl={stemUrl}
                    stemType={stem.type}
                    color={stemColors[stem.type]}
                    width={containerWidth}
                    height={STEM_HEIGHT}
                    className="opacity-60"
                  />
                )}

                {/* Spectrogram Visualization */}
                {view === 'spectrogram' && stemUrl && containerWidth > 0 && (
                  <SpectrogramCanvas
                    audioUrl={stemUrl}
                    stemType={stem.type}
                    color={stemColors[stem.type]}
                    width={containerWidth}
                    height={STEM_HEIGHT}
                    className="opacity-80"
                  />
                )}
              </div>
            )
          })}

          {/* Analysis Overlays - Span all stems */}
          {analysisData && (
            <AnalysisOverlays
              analysisData={analysisData}
              duration={duration}
              overlays={overlays}
              height={stems.length * STEM_HEIGHT}
            />
          )}
        </div>

        {/* Playhead - Spans all stems */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-500 shadow-lg shadow-accent-500/50"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-accent-500 shadow-lg shadow-accent-500/50" />
          <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-accent-500 shadow-lg shadow-accent-500/50" />
        </div>

        {/* Loop Markers - Span all stems */}
        {loopStartPosition !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-green-500/70"
            style={{ left: `${loopStartPosition}%` }}
          >
            <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-green-500" />
            <div className="absolute top-1 left-2 rounded bg-green-500/80 px-1.5 py-0.5 font-mono text-xs text-white shadow-md">
              A
            </div>
          </div>
        )}
        {loopEndPosition !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-500/70"
            style={{ left: `${loopEndPosition}%` }}
          >
            <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-red-500" />
            <div className="absolute top-1 left-2 rounded bg-red-500/80 px-1.5 py-0.5 font-mono text-xs text-white shadow-md">
              B
            </div>
          </div>
        )}

        {/* Loop Region Highlight - Span all stems */}
        {loopStartPosition !== null && loopEndPosition !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 bg-accent-500/10"
            style={{
              left: `${loopStartPosition}%`,
              width: `${loopEndPosition - loopStartPosition}%`,
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex items-center justify-between font-mono text-xs text-gray-500">
        <span>
          {view === 'waveform' && 'Waveform: Audio amplitude over time'}
          {view === 'spectrogram' && 'Spectrogram: Frequency content over time'}
        </span>
        <span>
          {analysisData
            ? `Overlays: ${overlays.size > 0 ? Array.from(overlays).join(', ') : 'none'}`
            : 'No analysis data'}
        </span>
      </div>
    </div>
  )
}

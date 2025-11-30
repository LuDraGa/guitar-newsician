import { cn } from '@/utils'
import { useEffect, useRef, useState } from 'react'
import { LyricLine, LyricsState } from './types'

interface LyricsPanelProps {
  lyrics: LyricLine[] | null // Synced lyrics (.lrc format)
  staticLyrics?: string // Fallback static lyrics
  currentTime: number
  lyricsState: LyricsState
  onAutoScrollToggle: () => void
  onOffsetChange: (offset: number) => void
  onSeek: (time: number) => void
  className?: string
}

export function LyricsPanel({
  lyrics,
  staticLyrics,
  currentTime,
  lyricsState,
  onAutoScrollToggle,
  onOffsetChange,
  onSeek,
  className,
}: LyricsPanelProps) {
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const [activeLine, setActiveLine] = useState<number>(-1)

  // Find current active line based on time + offset
  useEffect(() => {
    if (!lyrics) return

    const adjustedTime = currentTime + lyricsState.offset / 1000

    // Find the last line that should be active
    let activeIndex = -1
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].timestamp <= adjustedTime) {
        activeIndex = i
      } else {
        break
      }
    }

    setActiveLine(activeIndex)
  }, [currentTime, lyrics, lyricsState.offset])

  // Auto-scroll to active line
  useEffect(() => {
    if (!lyricsState.autoScroll || activeLine === -1 || !lyricsContainerRef.current) return

    const container = lyricsContainerRef.current
    const activeLyricEl = container.querySelector(`[data-line-index="${activeLine}"]`)

    if (activeLyricEl) {
      activeLyricEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeLine, lyricsState.autoScroll])

  const handleLineClick = (line: LyricLine) => {
    onSeek(line.timestamp)
  }

  // Render synced lyrics
  if (lyrics && lyrics.length > 0) {
    return (
      <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>
          <div className="flex items-center gap-2">
            {/* Auto-scroll Toggle */}
            <button
              onClick={onAutoScrollToggle}
              className={cn(
                'rounded border px-2 py-1 font-sans text-xs transition-all',
                lyricsState.autoScroll
                  ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                  : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10'
              )}
              title="Auto-scroll"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Offset Slider */}
        <div className="flex items-center gap-3">
          <label className="font-sans text-xs text-gray-400">Offset:</label>
          <input
            type="range"
            min="-2000"
            max="2000"
            step="50"
            value={lyricsState.offset}
            onChange={(e) => onOffsetChange(parseInt(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-dark-400"
          />
          <span className="min-w-[60px] text-right font-mono text-xs text-gray-500">
            {lyricsState.offset > 0 ? '+' : ''}
            {lyricsState.offset}ms
          </span>
        </div>

        {/* Lyrics List */}
        <div ref={lyricsContainerRef} className="flex-1 space-y-2 overflow-y-auto pr-2" style={{ maxHeight: '500px' }}>
          {lyrics.map((line, index) => (
            <div
              key={index}
              data-line-index={index}
              onClick={() => handleLineClick(line)}
              className={cn(
                'cursor-pointer rounded-lg border p-3 transition-all',
                index === activeLine
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400 shadow-lg shadow-accent-500/20'
                  : 'border-transparent bg-dark-300/20 text-gray-400 hover:border-white/10 hover:bg-dark-300/40'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-gray-500">
                  {Math.floor(line.timestamp / 60)}:{String(Math.floor(line.timestamp % 60)).padStart(2, '0')}
                </span>
                <p className={cn('flex-1 font-sans text-sm leading-relaxed', index === activeLine && 'font-semibold')}>
                  {line.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
          Click any line to seek to that time
        </div>
      </div>
    )
  }

  // Render static lyrics fallback
  if (staticLyrics) {
    return (
      <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>
          <span className="font-mono text-xs text-gray-500">Static</span>
        </div>

        {/* Static Lyrics */}
        <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '500px' }}>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-300">{staticLyrics}</pre>
        </div>
      </div>
    )
  }

  // No lyrics available
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-400">Lyrics</h3>
      </div>

      {/* No Lyrics Message */}
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="mx-auto mb-3 h-12 w-12 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="font-sans text-sm text-gray-500">No lyrics available</p>
        </div>
      </div>
    </div>
  )
}

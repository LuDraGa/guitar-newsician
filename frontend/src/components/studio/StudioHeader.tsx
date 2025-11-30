import { Song } from '@/types/song'
import { cn } from '@/utils'
import { useState, useRef, useEffect } from 'react'

interface StudioHeaderProps {
  song: Song
  onClose: () => void
  onConvert?: () => void
  onAnalyze?: () => void
  onSeparateStems?: () => void
  onDelete?: () => void
  className?: string
}

export function StudioHeader({
  song,
  onClose,
  onConvert,
  onAnalyze,
  onSeparateStems,
  onDelete,
  className,
}: StudioHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('flex items-center justify-between border-b border-white/5 p-4', className)}>
      {/* Song Info */}
      <div className="flex-1">
        <h2 className="font-display text-xl font-bold text-white">{song.title}</h2>
        <p className="mt-0.5 font-sans text-sm text-gray-400">{song.artist}</p>
      </div>

      {/* Actions Dropdown */}
      <div className="relative mr-4" ref={dropdownRef}>
        <button
          onClick={() => setActionsOpen(!actionsOpen)}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-dark-300/50 px-4 py-2 font-sans text-sm text-gray-300 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
        >
          Actions
          <svg
            className={cn('h-4 w-4 transition-transform', actionsOpen && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {actionsOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-lg border border-white/10 bg-dark-300/95 backdrop-blur-xl shadow-xl">
            {/* Convert */}
            {!song.has_converted && onConvert && (
              <button
                onClick={() => {
                  onConvert()
                  setActionsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 font-sans text-sm text-gray-300 transition-colors hover:bg-accent-500/10 hover:text-accent-400 first:rounded-t-lg"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Convert to WAV
              </button>
            )}

            {/* Analyze */}
            {onAnalyze && (
              <button
                onClick={() => {
                  onAnalyze()
                  setActionsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 font-sans text-sm text-gray-300 transition-colors hover:bg-accent-500/10 hover:text-accent-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                {song.has_analysis ? 'Re-Analyze' : 'Analyze'}
              </button>
            )}

            {/* Separate Stems */}
            {onSeparateStems && (
              <button
                onClick={() => {
                  onSeparateStems()
                  setActionsOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 font-sans text-sm text-gray-300 transition-colors hover:bg-accent-500/10 hover:text-accent-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                Separate Stems (6-stem)
              </button>
            )}

            {/* Delete */}
            {onDelete && (
              <>
                <div className="my-1 border-t border-white/5" />
                <button
                  onClick={() => {
                    if (confirm(`Delete analysis and stems for "${song.title}"?`)) {
                      onDelete()
                      setActionsOpen(false)
                    }
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 font-sans text-sm text-red-400 transition-colors hover:bg-red-500/10 last:rounded-b-lg"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

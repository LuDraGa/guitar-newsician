import { cn } from '@/utils'
import { useState, useEffect, useCallback } from 'react'
import { LyricLine } from '../types'

interface ManualSyncEditorProps {
  staticLyrics: string // Plain text lyrics to sync
  currentTime: number // Current playback time
  isPlaying: boolean
  onContentChange: (lrcContent: string) => void
  className?: string
}

interface SyncLine {
  text: string
  timestamp: number | null // null if not synced yet
}

export function ManualSyncEditor({
  staticLyrics,
  currentTime,
  isPlaying,
  onContentChange,
  className,
}: ManualSyncEditorProps) {
  // Parse static lyrics into lines
  const [lines, setLines] = useState<SyncLine[]>(() => {
    return staticLyrics
      .split('\n')
      .filter(line => line.trim())
      .map(text => ({ text: text.trim(), timestamp: null }))
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState(0)

  // Convert lines to LRC format
  const generateLRC = useCallback(() => {
    return lines
      .filter(line => line.timestamp !== null)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map(line => {
        const time = line.timestamp || 0
        const minutes = Math.floor(time / 60)
        const seconds = (time % 60).toFixed(2)
        return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}]${line.text}`
      })
      .join('\n')
  }, [lines])

  // Update content when lines change
  useEffect(() => {
    onContentChange(generateLRC())
  }, [lines, generateLRC, onContentChange])

  // Handle marking a line with current timestamp
  const markLine = (index: number) => {
    setLines(prev => {
      const newLines = [...prev]
      newLines[index] = { ...newLines[index], timestamp: currentTime }
      return newLines
    })

    // Auto-advance to next line in sync mode
    if (isSyncing && index === currentLineIndex && index < lines.length - 1) {
      setCurrentLineIndex(index + 1)
    }
  }

  // Handle key press for quick marking (Space or Enter)
  useEffect(() => {
    if (!isSyncing) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        markLine(currentLineIndex)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [isSyncing, currentLineIndex, currentTime])

  // Reset all timestamps
  const resetAll = () => {
    if (confirm('Reset all timestamps? This cannot be undone.')) {
      setLines(prev => prev.map(line => ({ ...line, timestamp: null })))
      setCurrentLineIndex(0)
    }
  }

  // Start/stop sync session
  const toggleSyncSession = () => {
    setIsSyncing(!isSyncing)
    if (!isSyncing) {
      // Starting sync - find first unsynced line
      const firstUnsynced = lines.findIndex(line => line.timestamp === null)
      if (firstUnsynced !== -1) {
        setCurrentLineIndex(firstUnsynced)
      }
    }
  }

  const syncedCount = lines.filter(line => line.timestamp !== null).length
  const progress = (syncedCount / lines.length) * 100

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Instructions */}
      <div className="rounded-lg bg-accent-500/5 p-3">
        <p className="mb-2 font-sans text-sm text-gray-400">
          📝 {lines.length} lines loaded. Play the audio and tap each line when it starts singing.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSyncSession}
            disabled={!isPlaying && !isSyncing}
            className={cn(
              'rounded border px-4 py-2 font-sans text-sm transition-all',
              isSyncing
                ? 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                : 'border-accent-500/30 bg-accent-500/20 text-accent-400 hover:bg-accent-500/30',
              !isPlaying && !isSyncing && 'cursor-not-allowed opacity-50'
            )}
          >
            {isSyncing ? '⏸ Pause Sync' : '▶ Start Sync Session'}
          </button>

          {syncedCount > 0 && (
            <button
              onClick={resetAll}
              className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 font-sans text-sm text-red-400 transition-all hover:bg-red-500/20"
            >
              Reset All
            </button>
          )}

          {!isPlaying && !isSyncing && (
            <span className="font-mono text-xs text-gray-500">
              ⚠ Audio must be playing to sync
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-dark-300/50">
            <div
              className="h-full bg-accent-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-sm text-gray-400">
          {syncedCount}/{lines.length}
        </span>
      </div>

      {/* Sync Mode Indicator */}
      {isSyncing && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-500/30 bg-accent-500/10 p-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent-500" />
          <span className="font-mono text-xs text-accent-400">
            SYNC MODE ACTIVE - Press Space or Enter to mark line
          </span>
        </div>
      )}

      {/* Lines List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-2" style={{ maxHeight: '400px' }}>
        {lines.map((line, index) => {
          const isSynced = line.timestamp !== null
          const isCurrent = isSyncing && index === currentLineIndex

          return (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3 transition-all',
                isCurrent
                  ? 'border-accent-500 bg-accent-500/10 shadow-lg shadow-accent-500/20'
                  : isSynced
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-white/5 bg-dark-300/20'
              )}
            >
              {/* Timestamp or Placeholder */}
              <div className="flex min-w-[70px] flex-col items-start gap-1">
                {isSynced ? (
                  <>
                    <span className="font-mono text-xs text-green-400">
                      {Math.floor(line.timestamp! / 60)}:
                      {String(Math.floor(line.timestamp! % 60)).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => {
                        setLines(prev => {
                          const newLines = [...prev]
                          newLines[index] = { ...newLines[index], timestamp: null }
                          return newLines
                        })
                      }}
                      className="font-mono text-xs text-gray-500 hover:text-red-400"
                      title="Clear timestamp"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <span className="font-mono text-xs text-gray-600">--:--</span>
                )}
              </div>

              {/* Line Text */}
              <p
                className={cn(
                  'flex-1 font-sans text-sm leading-relaxed',
                  isCurrent ? 'font-semibold text-accent-400' : isSynced ? 'text-gray-300' : 'text-gray-400'
                )}
              >
                {line.text}
              </p>

              {/* Mark Button */}
              <button
                onClick={() => markLine(index)}
                disabled={!isPlaying && !line.timestamp}
                className={cn(
                  'rounded border px-3 py-1 font-mono text-xs transition-all',
                  isSynced
                    ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'border-accent-500/30 bg-accent-500/20 text-accent-400 hover:bg-accent-500/30',
                  !isPlaying && !line.timestamp && 'cursor-not-allowed opacity-30'
                )}
                title={isSynced ? 'Update timestamp' : 'Mark timestamp'}
              >
                {isSynced ? '✓' : 'Tap'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <div className="rounded-lg bg-dark-300/20 p-2 font-mono text-xs text-gray-500">
        💡 Tip: Click "Start Sync Session" then press Space/Enter as each line starts
      </div>
    </div>
  )
}

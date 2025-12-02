import { useState } from 'react'
import { cn } from '@/utils'
import { JobHistoryEntry } from '@/hooks/useJobTracker'

interface JobHistoryProps {
  history: JobHistoryEntry[]
  onClear?: () => void
  className?: string
}

export function JobHistory({ history, onClear, className }: JobHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (history.length === 0) {
    return null
  }

  const stateIcons = {
    completed: (
      <svg className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    failed: (
      <svg className="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    dismissed: (
      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  }

  const stateColors = {
    completed: 'text-green-400',
    failed: 'text-red-400',
    dismissed: 'text-gray-400',
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = Date.now()
    const diff = now - timestamp

    // Less than a minute
    if (diff < 60000) {
      return 'just now'
    }

    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}m ago`
    }

    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    }

    // Format as time
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={cn('rounded-lg border border-white/10 bg-dark-300/80 backdrop-blur-sm', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-sans text-sm font-medium text-white">Job History</span>
          <span className="font-mono text-xs text-gray-500">({history.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {onClear && history.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              className="rounded px-2 py-1 font-mono text-xs text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
              title="Clear history"
            >
              Clear
            </button>
          )}
          <svg
            className={cn('h-4 w-4 text-gray-400 transition-transform', isExpanded && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* History List */}
      {isExpanded && (
        <div className="max-h-[300px] overflow-y-auto border-t border-white/10">
          {history.map((entry, index) => (
            <div
              key={`${entry.jobId}-${entry.timestamp}`}
              className={cn(
                'flex items-start gap-3 border-b border-white/5 p-3 last:border-b-0',
                'transition-colors hover:bg-white/5'
              )}
            >
              {/* State icon */}
              <div className="flex-shrink-0 pt-0.5">{stateIcons[entry.state]}</div>

              {/* Content */}
              <div className="flex-1 space-y-1">
                {/* Song name - prominent */}
                {entry.songName && (
                  <div className="font-sans text-xs font-bold text-white">
                    {entry.songName}
                  </div>
                )}

                {/* Action and status on same line */}
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs font-medium capitalize text-gray-300">
                    {entry.actionName || entry.jobType?.replace('_', ' ') || 'Job'}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className={cn('font-mono text-xs font-semibold capitalize', stateColors[entry.state])}>
                    {entry.state}
                  </span>
                </div>

                {/* Error message if present */}
                {entry.error && (
                  <p className="font-mono text-xs text-red-300/80" title={entry.error}>
                    {entry.error.length > 50 ? `${entry.error.slice(0, 50)}...` : entry.error}
                  </p>
                )}

                {/* Job ID and timestamp */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">#{entry.jobId.slice(-6)}</span>
                  <span className="text-gray-600">•</span>
                  <span className="font-mono text-xs text-gray-500">{formatTimestamp(entry.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

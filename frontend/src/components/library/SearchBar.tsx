import { useState, useCallback } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onDownload?: (url: string) => void
  hasResults?: boolean
  className?: string
}

// Detect if input is a YouTube or YouTube Music URL
function isYouTubeUrl(input: string): boolean {
  const patterns = [
    /youtube\.com\/watch\?v=/i,
    /youtu\.be\//i,
    /music\.youtube\.com\/watch\?v=/i,
    /youtube\.com\/shorts\//i,
  ]
  return patterns.some(pattern => pattern.test(input))
}

// Detect if input looks like a URL (but not YouTube)
function isNonYouTubeUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function SearchBar({ value, onChange, onDownload, hasResults = true, className }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const isYTUrl = isYouTubeUrl(value)
  const isOtherUrl = !isYTUrl && isNonYouTubeUrl(value)
  const showDownload = isYTUrl && !hasResults && onDownload

  const handleDownload = useCallback(() => {
    if (showDownload) {
      onDownload!(value)
    }
  }, [showDownload, value, onDownload])

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'nav-glass flex items-center gap-3 rounded-full px-6 py-4 shadow-lg transition-all duration-200',
          isFocused && 'border-accent-500/30 shadow-accent-500/20'
        )}
      >
        {/* Search Icon */}
        <svg
          className="h-5 w-5 flex-shrink-0 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search by title, artist, or paste YouTube URL..."
          className="flex-1 bg-transparent font-sans text-base text-white placeholder-gray-500 outline-none"
        />

        {/* URL Status - Download Button or Message */}
        {showDownload && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
              <span className="font-mono text-xs text-accent-400">Not in library</span>
            </div>
            <Button
              size="sm"
              onClick={handleDownload}
              className="rounded-full"
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </Button>
          </div>
        )}

        {/* Non-YouTube URL Message */}
        {isOtherUrl && (
          <div className="flex items-center gap-2 rounded-full border border-gray-500/30 bg-gray-500/10 px-3 py-1">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-mono text-xs text-gray-400">YouTube URLs only</span>
          </div>
        )}
      </div>
    </div>
  )
}

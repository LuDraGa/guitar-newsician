import { cn } from '@/utils'
import { useState, useEffect, useCallback } from 'react'
import { LyricLine } from './types'
import { PlainTextEditor } from './editors/PlainTextEditor'
import { PasteLRCEditor } from './editors/PasteLRCEditor'
import { ManualSyncEditor } from './editors/ManualSyncEditor'
import { EditSyncedEditor } from './editors/EditSyncedEditor'

type EditMode = 'plain' | 'paste-lrc' | 'manual-sync' | 'edit-synced'

interface LyricsEditorProps {
  songId: string
  initialLyrics: LyricLine[] | null // Existing synced lyrics
  initialStaticLyrics?: string // Existing plain text lyrics
  currentTime: number // For manual sync mode
  isPlaying: boolean // For manual sync mode
  onSave: () => void // Callback after successful save
  onCancel: () => void
  className?: string
}

export function LyricsEditor({
  songId,
  initialLyrics,
  initialStaticLyrics,
  currentTime,
  isPlaying,
  onSave,
  onCancel,
  className,
}: LyricsEditorProps) {
  // Determine initial mode based on what exists
  const determineInitialMode = (): EditMode => {
    if (initialLyrics && initialLyrics.length > 0) {
      return 'edit-synced'
    } else if (initialStaticLyrics) {
      return 'plain' // Default to plain if only text exists
    } else {
      return 'plain' // Default to plain for new lyrics
    }
  }

  const [mode, setMode] = useState<EditMode>(determineInitialMode())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState<string>('')

  // Convert existing synced lyrics to LRC format
  const existingLRCContent = initialLyrics
    ? initialLyrics
        .map((line) => {
          const minutes = Math.floor(line.timestamp / 60)
          const seconds = (line.timestamp % 60).toFixed(2)
          return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}]${line.text}`
        })
        .join('\n')
    : undefined

  // Handle content changes from child editors
  const handleContentChange = useCallback((content: string) => {
    setCurrentContent(content)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        onCancel()
      }
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Validate content
      if (!currentContent.trim()) {
        throw new Error('Lyrics content cannot be empty')
      }

      // Determine type based on mode
      let type: 'plain' | 'synced' = mode === 'plain' ? 'plain' : 'synced'

      console.log('Saving lyrics:', { songId, type, contentLength: currentContent.length })

      // Call API
      const response = await fetch('/api/v1/lyrics/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: songId,
          type,
          content: currentContent,
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        // Try to get error details
        let errorMessage = 'Failed to save lyrics'
        try {
          const text = await response.text()
          // Try to parse as JSON
          try {
            const errorData = JSON.parse(text)
            errorMessage = errorData.detail || errorMessage
          } catch {
            // Not JSON, use raw text
            errorMessage = text || `HTTP ${response.status}: ${response.statusText}`
          }
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      // Parse success response
      const result = await response.json()
      console.log('Save successful:', result)

      // Clear localStorage drafts on successful save (song-specific)
      localStorage.removeItem(`lyrics-editor-draft-plain-${songId}`)
      localStorage.removeItem(`lyrics-editor-draft-lrc-${songId}`)

      // Success
      onSave()
    } catch (err) {
      console.error('Save failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to save lyrics')
    } finally {
      setIsSaving(false)
    }
  }, [mode, songId, currentContent, onSave])

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-400">Edit Lyrics</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 transition-colors hover:text-gray-300"
          title="Close editor"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setMode('plain')}
          className={cn(
            'rounded px-3 py-1.5 font-sans text-xs transition-all',
            mode === 'plain'
              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
              : 'text-gray-400 hover:bg-dark-300/50'
          )}
        >
          Plain Text
        </button>
        <button
          onClick={() => setMode('paste-lrc')}
          className={cn(
            'rounded px-3 py-1.5 font-sans text-xs transition-all',
            mode === 'paste-lrc'
              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
              : 'text-gray-400 hover:bg-dark-300/50'
          )}
        >
          Paste LRC
        </button>
        {initialStaticLyrics && (
          <button
            onClick={() => setMode('manual-sync')}
            className={cn(
              'rounded px-3 py-1.5 font-sans text-xs transition-all',
              mode === 'manual-sync'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-gray-400 hover:bg-dark-300/50'
            )}
          >
            Manual Sync
          </button>
        )}
        {initialLyrics && initialLyrics.length > 0 && (
          <button
            onClick={() => setMode('edit-synced')}
            className={cn(
              'rounded px-3 py-1.5 font-sans text-xs transition-all',
              mode === 'edit-synced'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-gray-400 hover:bg-dark-300/50'
            )}
          >
            Edit Synced
          </button>
        )}
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        {mode === 'plain' && (
          <PlainTextEditor
            songId={songId}
            initialContent={initialStaticLyrics}
            onContentChange={handleContentChange}
          />
        )}
        {mode === 'paste-lrc' && (
          <PasteLRCEditor
            songId={songId}
            existingLRC={existingLRCContent}
            onContentChange={handleContentChange}
          />
        )}
        {mode === 'manual-sync' && initialStaticLyrics && (
          <ManualSyncEditor
            staticLyrics={initialStaticLyrics}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onContentChange={handleContentChange}
          />
        )}
        {mode === 'edit-synced' && initialLyrics && initialLyrics.length > 0 && (
          <EditSyncedEditor
            initialLyrics={initialLyrics}
            onContentChange={handleContentChange}
          />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="font-mono text-xs text-gray-500">
          Esc to cancel • {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+S to save
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-white/10 bg-dark-300/50 px-4 py-2 font-sans text-sm text-gray-400 transition-all hover:border-white/20 hover:bg-dark-300/70"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded border border-accent-500/30 bg-accent-500/20 px-4 py-2 font-sans text-sm text-accent-400 transition-all hover:bg-accent-500/30 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

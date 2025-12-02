import { cn } from '@/utils'
import { useState, useEffect, useCallback } from 'react'
import { LyricLine } from '../types'

interface EditSyncedEditorProps {
  initialLyrics: LyricLine[]
  onContentChange: (lrcContent: string) => void
  className?: string
}

interface EditableLine {
  id: string
  timestamp: number
  text: string
}

export function EditSyncedEditor({ initialLyrics, onContentChange, className }: EditSyncedEditorProps) {
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initialLyrics.map((line, idx) => ({
      id: `${line.timestamp}-${idx}`,
      timestamp: line.timestamp,
      text: line.text,
    }))
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Convert lines to LRC format
  const generateLRC = useCallback(() => {
    return lines
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(line => {
        const minutes = Math.floor(line.timestamp / 60)
        const seconds = (line.timestamp % 60).toFixed(2)
        return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}]${line.text}`
      })
      .join('\n')
  }, [lines])

  // Update content when lines change
  useEffect(() => {
    onContentChange(generateLRC())
  }, [lines, generateLRC, onContentChange])

  // Add new line
  const addLine = () => {
    const newLine: EditableLine = {
      id: `new-${Date.now()}`,
      timestamp: lines.length > 0 ? lines[lines.length - 1].timestamp + 5 : 0,
      text: '',
    }
    setLines(prev => [...prev, newLine])
    setEditingId(newLine.id)
  }

  // Delete line
  const deleteLine = (id: string) => {
    if (confirm('Delete this line?')) {
      setLines(prev => prev.filter(line => line.id !== id))
    }
  }

  // Update line text
  const updateLineText = (id: string, text: string) => {
    setLines(prev => prev.map(line => (line.id === id ? { ...line, text } : line)))
  }

  // Update line timestamp
  const updateLineTimestamp = (id: string, timestamp: number) => {
    setLines(prev => prev.map(line => (line.id === id ? { ...line, timestamp } : line)))
  }

  // Parse time string (mm:ss or mm:ss.ms) to seconds
  const parseTimeString = (timeStr: string): number => {
    const parts = timeStr.split(':')
    if (parts.length !== 2) return 0

    const minutes = parseInt(parts[0]) || 0
    const seconds = parseFloat(parts[1]) || 0

    return minutes * 60 + seconds
  }

  // Format timestamp to mm:ss.ms
  const formatTimestamp = (timestamp: number): string => {
    const minutes = Math.floor(timestamp / 60)
    const seconds = (timestamp % 60).toFixed(2)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}`
  }

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    setLines(prev => {
      const draggedIndex = prev.findIndex(line => line.id === draggedId)
      const targetIndex = prev.findIndex(line => line.id === targetId)

      if (draggedIndex === -1 || targetIndex === -1) return prev

      const newLines = [...prev]
      const [draggedLine] = newLines.splice(draggedIndex, 1)
      newLines.splice(targetIndex, 0, draggedLine)

      return newLines
    })
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Instructions */}
      <div className="rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
        📝 {lines.length} synced lines loaded. Edit timestamps/text, drag to reorder, or add new lines.
      </div>

      {/* Lines List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-2" style={{ maxHeight: '450px' }}>
        {lines.map((line, index) => {
          const isEditing = editingId === line.id

          return (
            <div
              key={line.id}
              draggable
              onDragStart={() => handleDragStart(line.id)}
              onDragOver={e => handleDragOver(e, line.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-2 transition-all',
                draggedId === line.id ? 'opacity-50' : 'opacity-100',
                isEditing
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-white/5 bg-dark-300/20 hover:border-white/10'
              )}
            >
              {/* Drag Handle */}
              <button
                className="cursor-move pt-1 text-gray-600 hover:text-gray-400"
                title="Drag to reorder"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </button>

              {/* Timestamp Input */}
              <input
                type="text"
                value={formatTimestamp(line.timestamp)}
                onChange={e => {
                  const newTime = parseTimeString(e.target.value)
                  if (!isNaN(newTime)) {
                    updateLineTimestamp(line.id, newTime)
                  }
                }}
                onFocus={() => setEditingId(line.id)}
                onBlur={() => setEditingId(null)}
                className={cn(
                  'w-20 rounded border bg-dark-400/50 px-2 py-1 font-mono text-xs text-gray-300',
                  'focus:border-accent-500/50 focus:outline-none focus:ring-1 focus:ring-accent-500/20',
                  'border-white/10'
                )}
                placeholder="00:00.00"
              />

              {/* Text Input */}
              <input
                type="text"
                value={line.text}
                onChange={e => updateLineText(line.id, e.target.value)}
                onFocus={() => setEditingId(line.id)}
                onBlur={() => setEditingId(null)}
                className={cn(
                  'flex-1 rounded border bg-dark-400/50 px-2 py-1 font-sans text-sm text-gray-300',
                  'focus:border-accent-500/50 focus:outline-none focus:ring-1 focus:ring-accent-500/20',
                  'border-white/10'
                )}
                placeholder="Lyric line text..."
              />

              {/* Delete Button */}
              <button
                onClick={() => deleteLine(line.id)}
                className="rounded p-1 text-gray-600 transition-colors hover:bg-red-500/20 hover:text-red-400"
                title="Delete line"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Line Button */}
      <button
        onClick={addLine}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-dark-300/20 py-3 font-sans text-sm text-gray-400 transition-all hover:border-accent-500/30 hover:bg-accent-500/5 hover:text-accent-400"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Line
      </button>

      {/* Stats */}
      <div className="flex items-center justify-between rounded-lg bg-dark-300/20 p-2 font-mono text-xs text-gray-500">
        <span>{lines.length} lines</span>
        <span>
          Duration: {formatTimestamp(lines.length > 0 ? Math.max(...lines.map(l => l.timestamp)) : 0)}
        </span>
      </div>
    </div>
  )
}

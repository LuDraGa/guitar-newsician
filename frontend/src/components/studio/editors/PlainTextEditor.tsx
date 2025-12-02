import { cn } from '@/utils'
import { useState, useEffect } from 'react'

interface PlainTextEditorProps {
  initialContent?: string
  onContentChange: (content: string) => void
  className?: string
}

export function PlainTextEditor({ initialContent = '', onContentChange, className }: PlainTextEditorProps) {
  const [content, setContent] = useState(initialContent)

  useEffect(() => {
    // Auto-save to localStorage to prevent data loss
    const timer = setTimeout(() => {
      localStorage.setItem('lyrics-editor-draft-plain', content)
    }, 500)

    return () => clearTimeout(timer)
  }, [content])

  useEffect(() => {
    // Load draft on mount
    const draft = localStorage.getItem('lyrics-editor-draft-plain')
    if (draft && !initialContent) {
      setContent(draft)
    }
  }, [])

  useEffect(() => {
    onContentChange(content)
  }, [content, onContentChange])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Instructions */}
      <div className="rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
        {initialContent ? (
          <>📝 Existing lyrics loaded. Edit below or replace with new content.</>
        ) : (
          <>Type or paste plain text lyrics here. Press Ctrl/Cmd+S to save.</>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type or paste lyrics here...&#10;&#10;Example:&#10;First line of the song&#10;Second line of the song&#10;..."
        className={cn(
          'min-h-[400px] w-full resize-y rounded-lg border border-white/10 bg-dark-300/30 p-4',
          'font-sans text-sm leading-relaxed text-gray-300 placeholder:text-gray-600',
          'focus:border-accent-500/50 focus:outline-none focus:ring-2 focus:ring-accent-500/20'
        )}
        autoFocus
      />

      {/* Character count */}
      <div className="flex items-center justify-between font-mono text-xs text-gray-500">
        <span>{content.split('\n').filter(line => line.trim()).length} lines</span>
        <span>{content.length} characters</span>
      </div>
    </div>
  )
}

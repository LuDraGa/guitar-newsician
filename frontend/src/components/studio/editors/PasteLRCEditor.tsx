import { cn } from '@/utils'
import { useState, useEffect } from 'react'

interface PasteLRCEditorProps {
  initialContent?: string
  existingLRC?: string // Pre-populate with existing LRC if available
  onContentChange: (content: string) => void
  className?: string
}

export function PasteLRCEditor({ initialContent = '', existingLRC, onContentChange, className }: PasteLRCEditorProps) {
  const [content, setContent] = useState(() => {
    // Prioritize existing LRC content
    if (existingLRC) return existingLRC
    if (initialContent) return initialContent
    return ''
  })
  const [isValid, setIsValid] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    // Auto-save to localStorage
    const timer = setTimeout(() => {
      localStorage.setItem('lyrics-editor-draft-lrc', content)
    }, 500)

    return () => clearTimeout(timer)
  }, [content])

  useEffect(() => {
    // Load draft on mount
    const draft = localStorage.getItem('lyrics-editor-draft-lrc')
    if (draft && !initialContent) {
      setContent(draft)
    }
  }, [])

  useEffect(() => {
    // Validate LRC format
    if (content.trim()) {
      const lrcPattern = /\[\d{2}:\d{2}\.\d{2}\]/
      const hasValidFormat = lrcPattern.test(content)

      if (hasValidFormat) {
        setIsValid(true)
        setValidationMessage('Valid LRC format detected')
      } else {
        setIsValid(false)
        setValidationMessage('Invalid format. Expected: [00:12.00]Line text')
      }
    } else {
      setIsValid(true)
      setValidationMessage('')
    }

    onContentChange(content)
  }, [content, onContentChange])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Instructions */}
      <div className="rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
        {existingLRC ? (
          <>📝 Existing lyrics loaded. Edit below or paste new content.</>
        ) : (
          <>Paste LRC format lyrics. Format: [mm:ss.xx]Line text</>
        )}
      </div>

      {/* Example */}
      <details className="rounded-lg bg-dark-300/20 p-2">
        <summary className="cursor-pointer font-mono text-xs text-gray-400 hover:text-gray-300">
          Show example format
        </summary>
        <pre className="mt-2 overflow-x-auto font-mono text-xs text-gray-500">
{`[00:12.00]First line of lyrics
[00:15.50]Second line of lyrics
[00:18.75]Third line of lyrics
[00:23.00]And so on...`}
        </pre>
      </details>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste LRC format lyrics here...&#10;&#10;[00:12.00]First line&#10;[00:15.50]Second line&#10;..."
        className={cn(
          'min-h-[400px] w-full resize-y rounded-lg border p-4',
          'font-mono text-sm leading-relaxed placeholder:text-gray-600',
          'focus:outline-none focus:ring-2',
          isValid
            ? 'border-white/10 bg-dark-300/30 text-gray-300 focus:border-accent-500/50 focus:ring-accent-500/20'
            : 'border-red-500/30 bg-red-500/5 text-red-300 focus:border-red-500/50 focus:ring-red-500/20'
        )}
        autoFocus
        spellCheck={false}
      />

      {/* Validation message */}
      {validationMessage && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border p-2 font-mono text-xs',
            isValid
              ? 'border-green-500/30 bg-green-500/5 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          )}
        >
          {isValid ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          <span>{validationMessage}</span>
        </div>
      )}

      {/* Line count */}
      <div className="flex items-center justify-between font-mono text-xs text-gray-500">
        <span>{content.split('\n').filter(line => line.trim()).length} lines</span>
        <span>{content.length} characters</span>
      </div>
    </div>
  )
}

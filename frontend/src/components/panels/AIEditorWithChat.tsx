/**
 * AIEditor Component with Chat Mode
 * Edit Mode: Fix MIDI transcription issues
 * Chat Mode: Conversational MIDI analysis
 */

import { useState } from 'react'
import { Sparkles, Check, X, AlertCircle, MessageCircle, Wrench, Send } from 'lucide-react'
import { midiEditorService, EditRequest, ProposedChange, ChatMessage, ChatResponse } from '@/services/midiEditorService'
import { cn } from '@/utils'

interface AIEditorProps {
  songId: string
  stemName: string
  section: { start: number; end: number } | null
  onApprove: (sessionId: string) => Promise<void>
  onReject: (sessionId: string) => Promise<void>
  className?: string
}

type Mode = 'edit' | 'chat'

export function AIEditor({
  songId,
  stemName,
  section,
  onApprove,
  onReject,
  className,
}: AIEditorProps) {
  // Mode state
  const [mode, setMode] = useState<Mode>('edit')

  // Edit mode state
  const [issueDescription, setIssueDescription] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([])
  const [analysisSummary, setAnalysisSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showWhatCanAIFix, setShowWhatCanAIFix] = useState(false)

  // Chat mode state
  const [chatQuery, setChatQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isChatting, setIsChatting] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const editPrompts = [
    'This section has a guitar bend that wasn\'t detected',
    'These notes should be merged into one sustained note',
    'The timing of this note is slightly off',
    'Wrong pitch detected here',
    'Missing a note that I can hear in the audio',
    'This note shouldn\'t be here'
  ]

  const chatPrompts = [
    'What chords are used in this section?',
    'Are there any repeated patterns?',
    'What\'s the key of this piece?',
    'Explain the chord progression',
    'What\'s the overall structure?',
    'Compare this to the previous section'
  ]

  const handleRequestEdit = async () => {
    if (!section || !issueDescription.trim()) return

    setIsRequesting(true)
    setError(null)

    try {
      const request: EditRequest = {
        song_id: songId,
        stem_name: stemName,
        section_start: section.start,
        section_end: section.end,
        issue_description: issueDescription,
      }

      const response = await midiEditorService.edit(request)

      setSessionId(response.change_session_id)
      setProposedChanges(response.proposed_changes)
      setAnalysisSummary(response.analysis_summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request edit')
    } finally {
      setIsRequesting(false)
    }
  }

  const handleApproveClick = async () => {
    if (!sessionId) return
    setIsRequesting(true)
    try {
      await onApprove(sessionId)
      resetState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes')
    } finally {
      setIsRequesting(false)
    }
  }

  const handleRejectClick = async () => {
    if (!sessionId) return
    await onReject(sessionId)
    resetState()
  }

  const resetState = () => {
    setSessionId(null)
    setProposedChanges([])
    setAnalysisSummary('')
    setIssueDescription('')
  }

  const handleSendChat = async () => {
    if (!chatQuery.trim()) return

    setIsChatting(true)
    setChatError(null)

    // Add user message to history
    const userMessage: ChatMessage = { role: 'user', content: chatQuery }
    const newHistory = [...chatHistory, userMessage]
    setChatHistory(newHistory)
    setChatQuery('')

    try {
      const response = await midiEditorService.chat({
        song_id: songId,
        stem_name: stemName,
        query: chatQuery,
        section_start: section?.start,
        section_end: section?.end,
        conversation_history: chatHistory,
      })

      // Add assistant response to history
      const assistantMessage: ChatMessage = { role: 'assistant', content: response.response }
      setChatHistory([...newHistory, assistantMessage])
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to get response')
      // Remove user message on error
      setChatHistory(chatHistory)
    } finally {
      setIsChatting(false)
    }
  }

  const clearChat = () => {
    setChatHistory([])
    setChatQuery('')
    setChatError(null)
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
        {/* Header with Mode Toggle */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-400" />
            <h4 className="font-display text-sm font-semibold text-white">AI Assistant</h4>
          </div>

          {/* Mode Toggle */}
          <div className="flex rounded-lg border border-white/10 bg-dark-400/30 p-0.5">
            <button
              onClick={() => setMode('edit')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-all',
                mode === 'edit'
                  ? 'bg-accent-500/20 text-accent-400 font-semibold'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Wrench className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => setMode('chat')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-all',
                mode === 'chat'
                  ? 'bg-blue-500/20 text-blue-400 font-semibold'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <MessageCircle className="h-3 w-3" />
              Chat
            </button>
          </div>
        </div>

        {/* EDIT MODE */}
        {mode === 'edit' && (
          <>
            {/* Section requirement */}
            {!section && (
              <div className="rounded-xl border border-white/10 bg-dark-300/30 p-6">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-gray-600" />
                  <p className="mt-3 font-mono text-sm text-gray-500">
                    Select a section on the piano roll to use AI editing
                  </p>
                </div>
              </div>
            )}

            {section && !sessionId && (
              <>
                {/* What can AI fix guide */}
                <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <button
                    onClick={() => setShowWhatCanAIFix(!showWhatCanAIFix)}
                    className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-blue-500/10"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        What can the AI fix?
                      </span>
                    </div>
                    <svg
                      className={`h-4 w-4 text-blue-400 transition-transform ${showWhatCanAIFix ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showWhatCanAIFix && (
                    <div className="border-t border-blue-500/20 p-3 space-y-2">
                      <div className="rounded bg-dark-400/30 p-2">
                        <div className="font-mono text-xs font-semibold text-white mb-1">
                          🎸 Missing Pitch Bends/Slides
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          "This section has a guitar bend" → AI adds smooth pitch bend
                        </div>
                      </div>

                      <div className="rounded bg-dark-400/30 p-2">
                        <div className="font-mono text-xs font-semibold text-white mb-1">
                          🎵 Incorrect Note Splitting
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          "Two notes should be one note" → AI merges them into sustained note
                        </div>
                      </div>

                      <div className="rounded bg-dark-400/30 p-2">
                        <div className="font-mono text-xs font-semibold text-white mb-1">
                          ⏱️ Timing Issues
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          "Note starts too early" → AI adjusts note timing
                        </div>
                      </div>

                      <div className="rounded bg-dark-400/30 p-2">
                        <div className="font-mono text-xs font-semibold text-white mb-1">
                          🎹 Wrong/Missing Notes
                        </div>
                        <div className="font-mono text-[10px] text-gray-400">
                          "Wrong pitch" or "Missing note" → AI corrects or adds notes
                        </div>
                      </div>

                      <div className="mt-2 rounded border border-blue-500/20 bg-blue-500/5 p-2">
                        <div className="font-mono text-[10px] text-blue-400">
                          💡 Tip: Describe what you <span className="font-semibold">hear in the audio</span> vs what's in the MIDI. The AI will analyze both and propose fixes.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Section */}
                <div className="mb-3 rounded-lg border border-white/5 bg-dark-400/30 p-3">
                  <div className="font-mono text-xs text-gray-400">Selected Section</div>
                  <div className="mt-1 font-mono text-sm text-accent-400">
                    {section.start.toFixed(2)}s - {section.end.toFixed(2)}s
                    <span className="ml-2 text-gray-500">
                      ({(section.end - section.start).toFixed(2)}s duration)
                    </span>
                  </div>
                </div>

                {/* Issue Description Input */}
                <div className="mb-3">
                  <label className="mb-1.5 block font-mono text-xs text-gray-400">
                    Describe the issue
                  </label>
                  <textarea
                    value={issueDescription}
                    onChange={e => setIssueDescription(e.target.value)}
                    placeholder="e.g., 'This section has a guitar bend that wasn't detected'"
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 outline-none focus:border-accent-500/30"
                  />
                </div>

                {/* Example Prompts - Always Visible */}
                <div className="mb-4">
                  <div className="mb-2 font-mono text-xs text-gray-500">Quick prompts:</div>
                  <div className="flex flex-wrap gap-2">
                    {editPrompts.map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => setIssueDescription(prompt)}
                        className="rounded-full border border-white/10 bg-dark-400/30 px-3 py-1.5 font-mono text-xs text-gray-400 transition-colors hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Request Button */}
                <button
                  onClick={handleRequestEdit}
                  disabled={!issueDescription.trim() || isRequesting}
                  className="w-full rounded-lg bg-accent-500/20 px-4 py-2.5 font-display text-sm font-semibold text-accent-400 transition-all hover:bg-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRequesting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
                      Analyzing...
                    </div>
                  ) : (
                    'Request AI Edit'
                  )}
                </button>
              </>
            )}

            {/* Proposed Changes State */}
            {sessionId && proposedChanges.length > 0 && section && (
              <>
                {/* Analysis Summary */}
                {analysisSummary && (
                  <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                    <div className="mb-1 font-mono text-xs font-semibold text-blue-400">
                      Analysis
                    </div>
                    <p className="whitespace-pre-wrap font-mono text-xs text-gray-300">
                      {analysisSummary}
                    </p>
                  </div>
                )}

                {/* Proposed Changes */}
                <div className="mb-4 space-y-2">
                  <div className="font-mono text-xs font-semibold text-white">
                    Proposed Changes ({proposedChanges.length})
                  </div>
                  {proposedChanges.map((change, idx) => {
                    const getOperationIcon = (type: string) => {
                      switch (type) {
                        case 'add_pitch_bend_sequence':
                        case 'add_pitch_bend':
                          return '🎸'
                        case 'merge_notes':
                          return '🎵'
                        case 'modify_note':
                          return '⏱️'
                        case 'add_note':
                          return '➕'
                        case 'delete_note':
                          return '🗑️'
                        default:
                          return '✨'
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-green-500/30 bg-green-500/10 p-3"
                      >
                        <div className="mb-1 flex items-start justify-between">
                          <div className="flex items-center gap-1.5">
                            <span>{getOperationIcon(change.type)}</span>
                            <div className="font-mono text-xs font-semibold text-green-400">
                              {change.type.replace(/_/g, ' ').toUpperCase()}
                            </div>
                          </div>
                          <div className="rounded-full bg-green-500/20 px-2 py-0.5 font-mono text-[10px] text-green-400">
                            #{idx + 1}
                          </div>
                        </div>
                        <p className="mb-2 font-mono text-xs text-gray-300">
                          {change.description}
                        </p>
                        {change.reasoning && (
                          <p className="font-mono text-[10px] text-gray-500">
                            💡 {change.reasoning}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Approve/Reject Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveClick}
                    disabled={isRequesting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500/20 px-4 py-2.5 font-display text-sm font-semibold text-green-400 transition-all hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Approve Changes
                  </button>
                  <button
                    onClick={handleRejectClick}
                    disabled={isRequesting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2.5 font-display text-sm font-semibold text-red-400 transition-all hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </>
            )}

            {/* Error State */}
            {error && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                  <p className="font-mono text-xs text-red-400">{error}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* CHAT MODE */}
        {mode === 'chat' && (
          <>
            {/* Section info (optional) */}
            {section && (
              <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="font-mono text-xs text-gray-400">Analyzing Section</div>
                <div className="mt-1 font-mono text-sm text-blue-400">
                  {section.start.toFixed(2)}s - {section.end.toFixed(2)}s
                  <span className="ml-2 text-gray-500">
                    (or ask about the whole MIDI)
                  </span>
                </div>
              </div>
            )}

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-dark-400/30 p-3">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg p-3',
                      msg.role === 'user'
                        ? 'bg-accent-500/10 border border-accent-500/20'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    )}
                  >
                    <div className="mb-1 font-mono text-xs font-semibold">
                      {msg.role === 'user' ? (
                        <span className="text-accent-400">You</span>
                      ) : (
                        <span className="text-blue-400">AI Music Theorist</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap font-mono text-xs text-gray-300">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {chatHistory.length === 0 && (
              <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="text-center">
                  <MessageCircle className="mx-auto h-8 w-8 text-blue-400" />
                  <p className="mt-2 font-mono text-xs text-blue-400">
                    Ask me anything about this MIDI!
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gray-500">
                    I can analyze chords, patterns, structure, and more
                  </p>
                </div>
              </div>
            )}

            {/* Example Questions - Always Visible */}
            <div className="mb-4">
              <div className="mb-2 font-mono text-xs text-gray-500">Quick questions:</div>
              <div className="flex flex-wrap gap-2">
                {chatPrompts.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => setChatQuery(prompt)}
                    className="rounded-full border border-white/10 bg-dark-400/30 px-3 py-1.5 font-mono text-xs text-gray-400 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input - Multi-line Textarea */}
            <div className="flex gap-2 items-end">
              <textarea
                value={chatQuery}
                onChange={e => setChatQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendChat()
                  }
                }}
                placeholder="Ask about chords, patterns, structure... (Shift+Enter for new line)"
                rows={3}
                className="flex-1 rounded-lg border border-white/10 bg-dark-400/50 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/30 resize-y"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatQuery.trim() || isChatting}
                className="rounded-lg bg-blue-500/20 px-4 py-2.5 font-display text-sm font-semibold text-blue-400 transition-all hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
              >
                {isChatting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Clear Chat Button */}
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                className="mt-2 w-full rounded-lg border border-white/10 bg-dark-400/30 px-4 py-2 font-mono text-xs text-gray-400 transition-colors hover:border-red-500/30 hover:text-red-400"
              >
                Clear Conversation
              </button>
            )}

            {/* Chat Error */}
            {chatError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                  <p className="font-mono text-xs text-red-400">{chatError}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

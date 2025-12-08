/**
 * AIEditor Component
 * Allows users to request AI-powered MIDI edits with natural language
 */

import { useState } from 'react'
import { Sparkles, Check, X, AlertCircle } from 'lucide-react'
import { midiEditorService, EditRequest, ProposedChange } from '@/services/midiEditorService'

interface AIEditorProps {
  songId: string
  stemName: string
  section: { start: number; end: number } | null
  onApprove: (sessionId: string) => Promise<void>
  onReject: (sessionId: string) => Promise<void>
  className?: string
}

export function AIEditor({
  songId,
  stemName,
  section,
  onApprove,
  onReject,
  className,
}: AIEditorProps) {
  const [issueDescription, setIssueDescription] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [proposedChanges, setProposedChanges] = useState<ProposedChange[]>([])
  const [analysisSummary, setAnalysisSummary] = useState('')
  const [error, setError] = useState<string | null>(null)

  const examplePrompts = [
    'This section has a guitar bend that wasn\'t detected',
    'These notes should be merged into one sustained note',
    'The timing of this note is slightly off',
    'Wrong pitch detected here',
    'Missing a note that I can hear in the audio',
    'This note shouldn\'t be here'
  ]

  const [showWhatCanAIFix, setShowWhatCanAIFix] = useState(false)

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

  if (!section) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-white/10 bg-dark-300/30 p-6">
          <div className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-gray-600" />
            <p className="mt-3 font-mono text-sm text-gray-500">
              Select a section on the piano roll to use AI editing
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-400" />
          <h4 className="font-display text-sm font-semibold text-white">AI MIDI Editor</h4>
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

        {/* No Changes Requested State */}
        {!sessionId && (
          <>
            {/* What can AI fix - Collapsible Guide */}
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

            {/* Example Prompts */}
            <div className="mb-4 flex flex-wrap gap-2">
              {examplePrompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => setIssueDescription(prompt)}
                  className="rounded-full border border-white/10 bg-dark-400/30 px-3 py-1 font-mono text-xs text-gray-400 transition-colors hover:border-accent-500/30 hover:text-accent-400"
                >
                  {prompt}
                </button>
              ))}
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
        {sessionId && proposedChanges.length > 0 && (
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
                // Helper to get operation icon
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
      </div>
    </div>
  )
}

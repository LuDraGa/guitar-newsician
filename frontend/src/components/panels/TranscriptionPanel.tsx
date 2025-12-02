import { cn } from '@/utils'
import { StemType } from '@/components/studio/types'

interface TranscriptionPanelProps {
  stemType: string
  songId: string
  onClose: () => void
  onStemChange?: (stemType: StemType) => void
  availableStems?: StemType[]
  className?: string
}

export function TranscriptionPanel({
  stemType,
  songId,
  onClose,
  onStemChange,
  availableStems = [],
  className,
}: TranscriptionPanelProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-4">
        <div>
          <h3 className="font-display text-lg font-bold capitalize text-white">
            {stemType} Transcription
          </h3>
          <p className="font-mono text-xs text-gray-500">AI-generated tabs & notation</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Transcription Options */}
        <div className="mb-6 space-y-3">
          <button className="w-full rounded-lg border border-white/10 bg-dark-300/30 p-3 text-left transition-all hover:border-accent-500/30 hover:bg-accent-500/10">
            <div className="mb-1 font-display text-sm font-semibold text-white">
              Guitar Tabs
            </div>
            <div className="font-mono text-xs text-gray-500">Standard notation & tablature</div>
          </button>

          <button className="w-full rounded-lg border border-white/10 bg-dark-300/30 p-3 text-left transition-all hover:border-accent-500/30 hover:bg-accent-500/10">
            <div className="mb-1 font-display text-sm font-semibold text-white">
              Piano Roll
            </div>
            <div className="font-mono text-xs text-gray-500">MIDI visualization</div>
          </button>

          <button className="w-full rounded-lg border border-white/10 bg-dark-300/30 p-3 text-left transition-all hover:border-accent-500/30 hover:bg-accent-500/10">
            <div className="mb-1 font-display text-sm font-semibold text-white">
              Chord Chart
            </div>
            <div className="font-mono text-xs text-gray-500">Chord progressions</div>
          </button>
        </div>

        {/* Transcription Preview Placeholder */}
        <div className="rounded-xl border border-white/10 bg-dark-300/30 p-6">
          <div className="mb-4 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <p className="mt-3 font-sans text-sm text-gray-400">
              Transcription UI coming soon
            </p>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="mt-6">
          <h4 className="mb-3 font-display text-sm font-semibold text-white">
            AI Tab Editor
          </h4>
          <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
            <p className="mb-3 font-mono text-xs text-gray-500">
              Ask AI to edit or improve transcription
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., 'Fix measure 4'"
                className="flex-1 rounded-lg border border-white/10 bg-dark-400/50 px-3 py-2 font-mono text-xs text-white placeholder-gray-600 outline-none focus:border-accent-500/30"
              />
              <button className="rounded-lg bg-accent-500/20 px-3 py-2 font-mono text-xs text-accent-400 transition-colors hover:bg-accent-500/30">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

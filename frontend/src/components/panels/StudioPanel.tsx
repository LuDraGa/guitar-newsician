import { Song } from '@/types/song'
import { cn } from '@/utils'

interface StudioPanelProps {
  song: Song
  onClose: () => void
  onStemSelect?: (stemType: string) => void
  className?: string
}

export function StudioPanel({ song, onClose, onStemSelect, className }: StudioPanelProps) {
  const availableStems = song.has_stems
    ? Object.keys(song.stem_files).filter((stem) => song.stem_files[stem])
    : []

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-6">
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-white">
            {song.title}
          </h2>
          <p className="mt-1 font-sans text-sm text-gray-400">{song.artist}</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="flex-1 overflow-y-auto p-6">
        {/* Audio Player Placeholder */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-dark-300/50 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/20">
              <svg className="h-6 w-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-white">Audio Player</h3>
              <p className="font-mono text-xs text-gray-500">Full mix playback</p>
            </div>
          </div>
          <div className="h-32 rounded-xl bg-dark-400/50" />
        </div>

        {/* Stems Section */}
        {song.has_stems && (
          <div>
            <h3 className="mb-4 font-display text-lg font-semibold text-white">
              Available Stems
            </h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {availableStems.map((stem) => (
                <button
                  key={stem}
                  onClick={() => onStemSelect?.(stem)}
                  className="group flex items-center gap-3 rounded-xl border border-white/10 bg-dark-300/30 p-4 transition-all hover:border-accent-500/30 hover:bg-accent-500/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/20 transition-colors group-hover:bg-accent-500/30">
                    <svg
                      className="h-5 w-5 text-accent-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-display text-sm font-semibold capitalize text-white">
                      {stem}
                    </div>
                    <div className="font-mono text-xs text-gray-500">Click to transcribe</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Info */}
        {song.has_analysis && (
          <div className="mt-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-white">
              Analysis
            </h3>
            <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
              <p className="font-mono text-sm text-gray-400">
                Analysis data available - UI coming soon
              </p>
            </div>
          </div>
        )}

        {/* Lyrics */}
        {song.has_lyrics && (
          <div className="mt-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-white">
              Lyrics
            </h3>
            <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
              <p className="font-mono text-sm text-gray-400">
                Lyrics available - UI coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

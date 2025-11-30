import { cn } from '@/utils'
import { PlaybackState } from './types'

interface PlaybackControlsProps {
  playbackState: PlaybackState
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onSpeedChange: (speed: number) => void
  onLoopToggle: () => void
  onSetLoopStart: () => void
  onSetLoopEnd: () => void
  onClearLoop: () => void
  onMetronomeToggle: () => void
  onMasterVolumeChange: (volume: number) => void
  className?: string
}

export function PlaybackControls({
  playbackState,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onSpeedChange,
  onLoopToggle,
  onSetLoopStart,
  onSetLoopEnd,
  onClearLoop,
  onMetronomeToggle,
  onMasterVolumeChange,
  className,
}: PlaybackControlsProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const currentTimeFormatted = formatTime(playbackState.currentTime)
  const durationFormatted = formatTime(playbackState.duration)
  const progress = playbackState.duration > 0 ? (playbackState.currentTime / playbackState.duration) * 100 : 0

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

  return (
    <div className={cn('flex flex-col gap-3 border-t border-white/5 bg-dark-400/20 p-4', className)}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-gray-400">{currentTimeFormatted}</span>
        <div className="relative flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => {
              const newProgress = parseInt(e.target.value) / 100
              onSeek(newProgress * playbackState.duration)
            }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, rgb(var(--accent-500)) 0%, rgb(var(--accent-500)) ${progress}%, rgb(var(--dark-400)) ${progress}%, rgb(var(--dark-400)) 100%)`,
            }}
          />
        </div>
        <span className="font-mono text-xs text-gray-400">{durationFormatted}</span>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-center justify-between">
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          {/* Previous */}
          <button
            onClick={onPrevious}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-dark-300/50 text-gray-300 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
            title="Previous"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-500/30 bg-accent-500/20 text-accent-400 transition-all hover:border-accent-500/50 hover:bg-accent-500/30 hover:shadow-lg hover:shadow-accent-500/20"
            title={playbackState.isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState.isPlaying ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-dark-300/50 text-gray-300 transition-all hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400"
            title="Next"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-gray-400">Speed:</span>
          <div className="flex gap-1">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={cn(
                  'rounded border px-2 py-1 font-mono text-xs transition-all',
                  playbackState.speed === speed
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Loop Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLoopToggle}
            className={cn(
              'rounded border px-3 py-1.5 font-sans text-xs transition-all',
              playbackState.loopEnabled
                ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10'
            )}
            title="Toggle Loop"
          >
            Loop
          </button>
          <div className="flex gap-1">
            <button
              onClick={onSetLoopStart}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded border font-mono text-xs transition-all',
                playbackState.loopStart !== null
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-green-500/30 hover:bg-green-500/10'
              )}
              title="Set Loop Start"
            >
              A
            </button>
            <button
              onClick={onSetLoopEnd}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded border font-mono text-xs transition-all',
                playbackState.loopEnd !== null
                  ? 'border-red-500 bg-red-500/20 text-red-400'
                  : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-red-500/30 hover:bg-red-500/10'
              )}
              title="Set Loop End"
            >
              B
            </button>
            {(playbackState.loopStart !== null || playbackState.loopEnd !== null) && (
              <button
                onClick={onClearLoop}
                className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-dark-300/50 text-gray-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                title="Clear Loop Points"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Metronome & Master Volume */}
        <div className="flex items-center gap-3">
          {/* Metronome */}
          <button
            onClick={onMetronomeToggle}
            className={cn(
              'rounded border px-3 py-1.5 font-sans text-xs transition-all',
              playbackState.metronomeEnabled
                ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                : 'border-white/10 bg-dark-300/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10'
            )}
            title="Metronome"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Master Volume */}
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={playbackState.masterVolume * 100}
              onChange={(e) => onMasterVolumeChange(parseInt(e.target.value) / 100)}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(to right, rgb(var(--accent-500)) 0%, rgb(var(--accent-500)) ${playbackState.masterVolume * 100}%, rgb(var(--dark-400)) ${playbackState.masterVolume * 100}%, rgb(var(--dark-400)) 100%)`,
              }}
            />
            <span className="min-w-[32px] text-right font-mono text-xs text-gray-400">
              {Math.round(playbackState.masterVolume * 100)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

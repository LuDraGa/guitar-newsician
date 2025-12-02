import { cn } from '@/utils'
import { StemState } from './types'

interface StemControlProps {
  stem: StemState
  onMuteToggle: () => void
  onSoloToggle: () => void
  onVolumeChange: (volume: number) => void
  onClick?: () => void
  masterVolume?: number // For showing effective volume
  className?: string
}

export function StemControl({
  stem,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
  onClick,
  masterVolume = 1.0,
  className,
}: StemControlProps) {
  const isSilenced = stem.muted || (stem.solo === false) // Muted or not soloed when others are
  const effectiveVolume = stem.volume * masterVolume
  const showEffective = masterVolume < 1.0

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-white/5 bg-dark-300/30 p-2 transition-all',
        onClick && 'cursor-pointer hover:border-accent-500/30 hover:bg-accent-500/5',
        isSilenced && 'opacity-40',
        className
      )}
      onClick={onClick}
    >
      {/* Stem Label */}
      <div className="min-w-[60px] font-sans text-sm font-medium capitalize text-gray-300">
        {stem.type}
      </div>

      {/* Mute Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMuteToggle()
        }}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-all',
          stem.muted
            ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'border-white/10 bg-dark-400/50 text-gray-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400'
        )}
        title="Mute"
      >
        M
      </button>

      {/* Solo Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSoloToggle()
        }}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-all',
          stem.solo
            ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            : 'border-white/10 bg-dark-400/50 text-gray-400 hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-400'
        )}
        title="Solo"
      >
        S
      </button>

      {/* Volume Slider */}
      <div className="relative flex flex-1 items-center">
        <input
          type="range"
          min="0"
          max="100"
          value={stem.volume * 100}
          onChange={(e) => {
            e.stopPropagation()
            onVolumeChange(parseInt(e.target.value) / 100)
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-dark-400"
          style={{
            background: `linear-gradient(to right, rgb(var(--accent-500)) 0%, rgb(var(--accent-500)) ${stem.volume * 100}%, rgb(var(--dark-400)) ${stem.volume * 100}%, rgb(var(--dark-400)) 100%)`,
          }}
        />
      </div>

      {/* Volume Value */}
      <div className="flex min-w-[70px] items-center justify-end gap-1 text-right font-mono text-xs">
        <span className="text-gray-500">{Math.round(stem.volume * 100)}</span>
        {showEffective && (
          <>
            <span className="text-gray-600">→</span>
            <span className="text-accent-400/70">{Math.round(effectiveVolume * 100)}</span>
          </>
        )}
      </div>
    </div>
  )
}

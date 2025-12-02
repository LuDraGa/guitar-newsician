import { cn } from '@/utils'
import { StemState } from './types'

interface StemControlProps {
  stem: StemState
  onMuteToggle: () => void
  onSoloToggle: () => void
  onVolumeChange: (volume: number) => void
  masterVolume?: number // For showing effective volume
  className?: string
}

export function StemControl({
  stem,
  onMuteToggle,
  onSoloToggle,
  onVolumeChange,
  masterVolume = 1.0,
  className,
}: StemControlProps) {
  const isSilenced = stem.muted || (stem.solo === false) // Muted or not soloed when others are
  const effectiveVolume = stem.volume * masterVolume
  const showEffective = masterVolume < 1.0

  return (
    <div
      className={cn(
        'group flex flex-col gap-2 rounded-lg border border-white/5 bg-dark-300/30 p-3 transition-all',
        isSilenced && 'opacity-40',
        className
      )}
    >
      {/* Top Row: Stem Label + M/S Buttons */}
      <div className="flex items-center justify-between">
        <div className="font-sans text-sm font-bold capitalize text-white">
          {stem.type}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mute Button */}
          <button
            onClick={onMuteToggle}
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
            onClick={onSoloToggle}
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
        </div>
      </div>

      {/* Bottom Row: Volume Slider (Full Width) */}
      <div className="flex items-center gap-3">
        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={stem.volume * 100}
            onChange={(e) => {
              onVolumeChange(parseInt(e.target.value) / 100)
            }}
            className="h-3.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.9) ${stem.volume * 100}%, rgba(255, 255, 255, 0.15) ${stem.volume * 100}%, rgba(255, 255, 255, 0.15) 100%)`,
            }}
          />
        </div>

        {/* Volume Value */}
        <div className="flex min-w-[60px] items-center justify-end gap-1 text-right font-mono text-xs">
          <span className="text-gray-100 font-semibold">{Math.round(stem.volume * 100)}</span>
          {showEffective && (
            <>
              <span className="text-gray-400">→</span>
              <span className="text-accent-400">{Math.round(effectiveVolume * 100)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

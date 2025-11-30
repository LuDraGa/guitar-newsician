import { cn } from '@/utils'
import { StemState, StemType } from './types'
import { StemControl } from './StemControl'

interface StemMixerProps {
  stems: StemState[]
  onStemUpdate: (type: StemType, updates: Partial<StemState>) => void
  onStemClick?: (type: StemType) => void
  masterVolume: number
  maxVolume: number
  onMasterVolumeChange: (volume: number) => void
  onMaxVolumeChange: (volume: number) => void
  className?: string
}

export function StemMixer({
  stems,
  onStemUpdate,
  onStemClick,
  masterVolume,
  maxVolume,
  onMasterVolumeChange,
  onMaxVolumeChange,
  className,
}: StemMixerProps) {
  const handleMuteToggle = (stem: StemState) => {
    onStemUpdate(stem.type, { muted: !stem.muted })
  }

  const handleSoloToggle = (stem: StemState) => {
    // If turning solo on, turn off all other solos
    // If turning solo off, just turn it off
    if (!stem.solo) {
      // Turn on this solo, turn off all others
      stems.forEach((s) => {
        if (s.type === stem.type) {
          onStemUpdate(s.type, { solo: true })
        } else {
          onStemUpdate(s.type, { solo: false })
        }
      })
    } else {
      // Turn off this solo
      onStemUpdate(stem.type, { solo: false })
    }
  }

  const handleVolumeChange = (stem: StemState, volume: number) => {
    onStemUpdate(stem.type, { volume })
  }

  const anySolo = stems.some((s) => s.solo)

  // Update stem states to reflect solo logic
  const effectiveStems = stems.map((stem) => ({
    ...stem,
    // If any stem is solo'd, non-solo stems should appear muted
    muted: stem.muted || (anySolo && !stem.solo),
  }))

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-white/5 bg-dark-400/20 p-4', className)}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-gray-400">
          Stem Mixer
        </h3>
        <div className="font-mono text-xs text-gray-500">
          {stems.filter((s) => !s.muted).length}/{stems.length} active
        </div>
      </div>

      {/* Stem Controls */}
      <div className="space-y-2">
        {effectiveStems.map((stem) => (
          <StemControl
            key={stem.type}
            stem={stem}
            onMuteToggle={() => handleMuteToggle(stem)}
            onSoloToggle={() => handleSoloToggle(stem)}
            onVolumeChange={(volume) => handleVolumeChange(stem, volume)}
            onClick={onStemClick ? () => onStemClick(stem.type) : undefined}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-white/5" />

      {/* Master Volume */}
      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-dark-300/30 p-2">
        <div className="min-w-[60px] font-sans text-sm font-bold text-white">Master</div>
        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume * 100}
            onChange={(e) => onMasterVolumeChange(parseInt(e.target.value) / 100)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, rgb(var(--accent-500)) 0%, rgb(var(--accent-500)) ${masterVolume * 100}%, rgb(var(--dark-400)) ${masterVolume * 100}%, rgb(var(--dark-400)) 100%)`,
            }}
          />
        </div>
        <div className="min-w-[32px] text-right font-mono text-xs text-gray-400">
          {Math.round(masterVolume * 100)}
        </div>
      </div>

      {/* Max Volume (Limiter) */}
      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-dark-300/30 p-2">
        <div className="min-w-[60px] font-sans text-sm font-bold text-orange-400">Max</div>
        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={maxVolume * 100}
            onChange={(e) => onMaxVolumeChange(parseInt(e.target.value) / 100)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right, rgb(239, 68, 68) 0%, rgb(239, 68, 68) ${maxVolume * 100}%, rgb(var(--dark-400)) ${maxVolume * 100}%, rgb(var(--dark-400)) 100%)`,
            }}
          />
        </div>
        <div className="min-w-[32px] text-right font-mono text-xs text-orange-400">
          {Math.round(maxVolume * 100)}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-2 rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
        Click any stem to open transcription
      </div>
    </div>
  )
}

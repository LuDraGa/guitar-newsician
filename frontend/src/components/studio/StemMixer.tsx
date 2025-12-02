import { cn } from '@/utils'
import { StemState, StemType } from './types'
import { StemControl } from './StemControl'

interface StemMixerProps {
  stems: StemState[]
  onStemUpdate: (type: StemType, updates: Partial<StemState>) => void
  onStemClick?: (type: StemType) => void
  masterVolume: number // For displaying effective volume in stem controls
  className?: string
}

export function StemMixer({
  stems,
  onStemUpdate,
  onStemClick,
  masterVolume,
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
            masterVolume={masterVolume}
          />
        ))}
      </div>

      {/* Hint */}
      <div className="mt-2 rounded-lg bg-accent-500/5 p-2 font-mono text-xs text-gray-500">
        Click any stem to open transcription
      </div>
    </div>
  )
}

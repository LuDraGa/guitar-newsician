import { cn } from '@/utils'

interface StatusPillProps {
  type: 'audio' | 'converted' | 'analysis' | 'stems' | 'lyrics' | 'synced_lyrics'
  active: boolean
  className?: string
}

export function StatusPill({ type, active, className }: StatusPillProps) {
  const config = {
    audio: { label: 'Audio', color: 'bg-accent-500/10 text-accent-400 border-accent-500/30' },
    converted: { label: 'WAV', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    analysis: { label: 'Analysis', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    stems: { label: 'Stems', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
    lyrics: { label: 'Lyrics', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    synced_lyrics: { label: 'Synced', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  }

  const { label, color } = config[type]
  const inactiveColor = 'bg-gray-800/30 text-gray-600 border-gray-700/30'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs transition-colors',
        active ? color : inactiveColor,
        className
      )}
    >
      <div className={cn('h-1 w-1 rounded-full', active ? 'bg-current' : 'bg-gray-600')} />
      {label}
    </span>
  )
}

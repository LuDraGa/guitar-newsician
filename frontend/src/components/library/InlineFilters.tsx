import { cn } from '@/utils'
import { FilterState } from './LibraryFilters'

interface InlineFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  className?: string
}

export function InlineFilters({ filters, onChange, className }: InlineFiltersProps) {
  const toggleFilter = (key: keyof FilterState) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  const filterOptions = [
    { key: 'hasAudio' as const, label: 'Audio', color: 'accent' },
    { key: 'hasConverted' as const, label: 'WAV', color: 'blue' },
    { key: 'hasAnalysis' as const, label: 'Analysis', color: 'purple' },
    { key: 'hasStems' as const, label: 'Stems', color: 'green' },
    { key: 'hasLyrics' as const, label: 'Lyrics', color: 'yellow' },
    { key: 'hasSyncedLyrics' as const, label: 'Synced', color: 'orange' },
  ]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {filterOptions.map(({ key, label, color }) => {
        const isActive = filters[key]
        const colorClasses = {
          accent: 'bg-accent-500/20 text-accent-400 border-accent-500/40',
          blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          purple: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          green: 'bg-green-500/20 text-green-400 border-green-500/40',
          yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          orange: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
        }

        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={cn(
              'rounded-full border px-3 py-1 font-mono text-xs transition-all',
              isActive
                ? colorClasses[color]
                : 'border-white/10 bg-dark-300/30 text-gray-500 hover:border-white/20 hover:text-gray-300'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

import { cn } from '@/utils'

export interface FilterState {
  hasAudio: boolean
  hasConverted: boolean
  hasAnalysis: boolean
  hasStems: boolean
  hasLyrics: boolean
  hasSyncedLyrics: boolean
}

interface LibraryFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  className?: string
}

export function LibraryFilters({ filters, onChange, className }: LibraryFiltersProps) {
  const toggleFilter = (key: keyof FilterState) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  const filterOptions = [
    { key: 'hasAudio' as const, label: 'Audio', color: 'accent' },
    { key: 'hasConverted' as const, label: 'WAV', color: 'blue' },
    { key: 'hasAnalysis' as const, label: 'Analysis', color: 'purple' },
    { key: 'hasStems' as const, label: 'Stems', color: 'green' },
    { key: 'hasLyrics' as const, label: 'Lyrics', color: 'yellow' },
    { key: 'hasSyncedLyrics' as const, label: 'Synced Lyrics', color: 'orange' },
  ]

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className={cn('nav-glass rounded-2xl p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-white">Filters</h3>
        {activeCount > 0 && (
          <button
            onClick={() =>
              onChange({
                hasAudio: false,
                hasConverted: false,
                hasAnalysis: false,
                hasStems: false,
                hasLyrics: false,
                hasSyncedLyrics: false,
              })
            }
            className="font-mono text-xs text-gray-500 transition-colors hover:text-accent-400"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filterOptions.map(({ key, label, color }) => {
          const isActive = filters[key]
          const colorClasses = {
            accent: 'bg-accent-500/10 text-accent-400 border-accent-500/30',
            blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            green: 'bg-green-500/10 text-green-400 border-green-500/30',
            yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          }

          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                isActive
                  ? colorClasses[color]
                  : 'border-white/5 bg-dark-300/30 text-gray-500 hover:border-white/10 hover:text-gray-300'
              )}
            >
              <div
                className={cn(
                  'h-4 w-4 rounded border-2 transition-all',
                  isActive
                    ? 'border-current bg-current'
                    : 'border-gray-600 bg-transparent'
                )}
              >
                {isActive && (
                  <svg
                    className="h-full w-full text-dark-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="font-mono text-xs">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

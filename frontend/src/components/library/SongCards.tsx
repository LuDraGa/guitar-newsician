import { Song } from '@/types/song'
import { StatusPill } from './StatusPill'
import { cn } from '@/utils'

interface SongCardsProps {
  songs: Song[]
  onSongClick?: (song: Song) => void
  className?: string
}

export function SongCards({ songs, onSongClick, className }: SongCardsProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {songs.map((song) => {
        const thumbnailUrl = song.metadata?.thumbnail

        return (
          <div
            key={song.song_id}
            onClick={() => onSongClick?.(song)}
            className="group relative cursor-pointer overflow-hidden rounded-2xl nav-glass shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-accent-500/20"
          >
            {/* Thumbnail Background */}
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-accent-500/20 via-dark-300 to-dark-400">
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt={song.title}
                    className="h-full w-full object-cover opacity-60 transition-all duration-300 group-hover:scale-110 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-400 via-dark-400/60 to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg
                    className="h-20 w-20 text-gray-700"
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
                </div>
              )}

              {/* Duration badge */}
              {song.duration && (
                <div className="absolute bottom-3 right-3 rounded-full bg-dark-400/90 backdrop-blur-sm px-2 py-1 font-mono text-xs text-gray-300">
                  {formatDuration(song.duration)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="mb-1 font-display text-base font-semibold text-white line-clamp-1 group-hover:text-accent-400 transition-colors">
                {song.title}
              </h3>
              <p className="mb-3 font-sans text-sm text-gray-400 line-clamp-1">
                {song.artist}
              </p>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-1.5">
                <StatusPill type="audio" active={song.has_audio} />
                <StatusPill type="converted" active={song.has_converted} />
                <StatusPill type="analysis" active={song.has_analysis} />
                <StatusPill type="stems" active={song.has_stems} />
                <StatusPill type="lyrics" active={song.has_lyrics} />
                <StatusPill type="synced_lyrics" active={song.has_synced_lyrics} />
              </div>
            </div>
          </div>
        )
      })}

      {songs.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="mb-4 h-16 w-16 text-gray-700"
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
          <h3 className="mb-2 font-display text-lg font-semibold text-gray-300">
            No songs found
          </h3>
          <p className="font-sans text-sm text-gray-500">
            Try a different search or download a song from YouTube
          </p>
        </div>
      )}
    </div>
  )
}

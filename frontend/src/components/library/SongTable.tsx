import { useState } from 'react'
import { Song } from '@/types/song'
import { StatusPill } from './StatusPill'
import { cn } from '@/utils'

type SortField = 'title' | 'artist' | 'duration' | 'download_date'
type SortOrder = 'asc' | 'desc'

interface SongTableProps {
  songs: Song[]
  onSongClick?: (song: Song) => void
  className?: string
}

export function SongTable({ songs, onSongClick, className }: SongTableProps) {
  const [sortField, setSortField] = useState<SortField>('download_date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedSongs = [...songs].sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sortField) {
      case 'title':
        aVal = a.title.toLowerCase()
        bVal = b.title.toLowerCase()
        break
      case 'artist':
        aVal = a.artist.toLowerCase()
        bVal = b.artist.toLowerCase()
        break
      case 'duration':
        aVal = a.duration || 0
        bVal = b.duration || 0
        break
      case 'download_date':
        aVal = a.download_date ? new Date(a.download_date).getTime() : 0
        bVal = b.download_date ? new Date(b.download_date).getTime() : 0
        break
      default:
        return 0
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortOrder === 'asc' ? (
      <svg className="h-4 w-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className={cn('nav-glass overflow-hidden rounded-2xl shadow-lg', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-2 font-display text-sm font-semibold text-gray-400 transition-colors hover:text-accent-400"
                >
                  Title
                  <SortIcon field="title" />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('artist')}
                  className="flex items-center gap-2 font-display text-sm font-semibold text-gray-400 transition-colors hover:text-accent-400"
                >
                  Artist
                  <SortIcon field="artist" />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('duration')}
                  className="flex items-center gap-2 font-display text-sm font-semibold text-gray-400 transition-colors hover:text-accent-400"
                >
                  Duration
                  <SortIcon field="duration" />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('download_date')}
                  className="flex items-center gap-2 font-display text-sm font-semibold text-gray-400 transition-colors hover:text-accent-400"
                >
                  Added
                  <SortIcon field="download_date" />
                </button>
              </th>
              <th className="px-6 py-4 text-left font-display text-sm font-semibold text-gray-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSongs.map((song) => (
              <tr
                key={song.song_id}
                onClick={() => onSongClick?.(song)}
                className="group cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="px-6 py-4">
                  <div className="font-sans text-base text-white group-hover:text-accent-400 transition-colors">
                    {song.title}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-sans text-sm text-gray-400">{song.artist}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-sm text-gray-500">
                    {formatDuration(song.duration)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-sm text-gray-500">
                    {formatDate(song.download_date)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill type="audio" active={song.has_audio} />
                    <StatusPill type="converted" active={song.has_converted} />
                    <StatusPill type="analysis" active={song.has_analysis} />
                    <StatusPill type="stems" active={song.has_stems} />
                    <StatusPill type="lyrics" active={song.has_lyrics} />
                    <StatusPill type="synced_lyrics" active={song.has_synced_lyrics} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedSongs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
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

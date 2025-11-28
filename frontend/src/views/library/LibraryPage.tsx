import { useState, useEffect, useMemo } from 'react'
import { Container } from '@/components/ui'
import { SearchBar } from '@/components/library/SearchBar'
import { SongTable } from '@/components/library/SongTable'
import { SongCards } from '@/components/library/SongCards'
import { InlineFilters } from '@/components/library/InlineFilters'
import { FilterState } from '@/components/library/LibraryFilters'
import { PanelLayout, StudioPanel, TranscriptionPanel } from '@/components/panels'
import { Song, ViewMode } from '@/types/song'
import { motion } from 'framer-motion'
import { cn } from '@/utils'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

export function LibraryPage() {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [filters, setFilters] = useState<FilterState>({
    hasAudio: false,
    hasConverted: false,
    hasAnalysis: false,
    hasStems: false,
    hasLyrics: false,
    hasSyncedLyrics: false,
  })

  // Panel state
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [selectedStem, setSelectedStem] = useState<string | null>(null)

  // Load songs from API
  const loadSongs = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/v1/library/songs`)
      const data = await response.json()
      setSongs(data.songs || [])
    } catch (error) {
      console.error('Failed to load songs:', error)
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSongs()
  }, [])

  // Filter and search songs
  const filteredSongs = useMemo(() => {
    let result = songs

    // Apply filters
    const hasActiveFilters = Object.values(filters).some(Boolean)
    if (hasActiveFilters) {
      result = result.filter((song) => {
        if (filters.hasAudio && !song.has_audio) return false
        if (filters.hasConverted && !song.has_converted) return false
        if (filters.hasAnalysis && !song.has_analysis) return false
        if (filters.hasStems && !song.has_stems) return false
        if (filters.hasLyrics && !song.has_lyrics) return false
        if (filters.hasSyncedLyrics && !song.has_synced_lyrics) return false
        return true
      })
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()

      // Try to extract video ID from search query (if it's a URL)
      // IMPORTANT: Extract from original searchQuery to preserve case-sensitive video ID
      const searchVideoId = extractYouTubeVideoId(searchQuery)

      result = result.filter((song) => {
        // Search by title
        if (song.title.toLowerCase().includes(query)) return true

        // Search by artist
        if (song.artist.toLowerCase().includes(query)) return true

        // If search query is a YouTube URL, match by video ID
        if (searchVideoId && song.metadata?.video_id === searchVideoId) return true

        // Fallback: search by full URL (for non-YouTube URLs)
        if (song.metadata?.webpage_url?.toLowerCase().includes(query)) return true

        return false
      })
    }

    return result
  }, [songs, searchQuery, filters])

  // Poll job status until completion
  const pollJobStatus = async (jobId: string): Promise<boolean> => {
    const maxAttempts = 60 // Poll for up to 2 minutes (60 * 2s = 120s)
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}`)
        if (!response.ok) break

        const data = await response.json()
        const status = data.status?.state

        if (status === 'completed') {
          return true
        } else if (status === 'failed' || status === 'cancelled') {
          console.error('Download job failed:', data.status?.error)
          return false
        }

        // Still running, wait before next poll
        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
      } catch (error) {
        console.error('Error polling job status:', error)
        break
      }
    }

    return false
  }

  // Handle download
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format: 'm4a', quality: 'high' }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Download started:', data)

        // Poll for completion and refresh songs list
        if (data.job_id) {
          const completed = await pollJobStatus(data.job_id)
          if (completed) {
            console.log('Download completed, refreshing library...')
            await loadSongs()
            // Clear search to show the new song
            setSearchQuery('')
          }
        }
      } else {
        console.error('Download failed:', response.statusText)
      }
    } catch (error) {
      console.error('Failed to start download:', error)
    }
  }

  // Handle song click - open studio
  const handleSongClick = (song: Song) => {
    setSelectedSong(song)
    setSelectedStem(null) // Reset stem selection
  }

  // Handle stem selection - open transcription
  const handleStemSelect = (stemType: string) => {
    setSelectedStem(stemType)
  }

  // Close handlers
  const handleCloseStudio = () => {
    setSelectedSong(null)
    setSelectedStem(null)
  }

  const handleCloseTranscription = () => {
    setSelectedStem(null)
  }

  // Library content
  const libraryContent = (
    <div className="flex h-screen flex-col bg-dark-400">
      {/* Background gradient mesh */}
      <div className="fixed inset-0 bg-gradient-mesh opacity-40" />

      {/* Floating Glassmorphic Nav */}
      <nav className="fixed left-1/2 top-6 z-50 -translate-x-1/2">
        <div className="nav-glass rounded-full px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-accent" />
              <span className="font-display text-sm font-semibold text-white">
                WereCode
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="/"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                Home
              </a>
              <a
                href="/library"
                className="text-sm text-accent-400 transition-colors hover:text-white"
              >
                Library
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Fixed Header Area */}
      <div className="relative flex-shrink-0 pt-24 pb-4">
        <Container>
          {/* Compact Header - Everything in one line */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[300px]">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onDownload={handleDownload}
                  hasResults={filteredSongs.length > 0}
                />
              </div>

              {/* Filters */}
              <div className="nav-glass rounded-full px-4 py-2">
                <InlineFilters filters={filters} onChange={setFilters} />
              </div>

              {/* View Toggle - Icons Only */}
              <div className="nav-glass flex items-center gap-1 rounded-full p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center justify-center rounded-full p-2 transition-all',
                    viewMode === 'table'
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                  title="Table view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 28 28" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                  </svg>

                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'flex items-center justify-center rounded-full p-2 transition-all',
                    viewMode === 'cards'
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                  title="Card view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 28 28" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Results Count - Small separate line */}
            <div className="mt-2 font-mono text-xs text-gray-600">
              {filteredSongs.length} {filteredSongs.length === 1 ? 'result' : 'results'}
              {filteredSongs.length !== songs.length && ` of ${songs.length}`}
            </div>
          </motion.div>
        </Container>
      </div>

      {/* Scrollable Content Area */}
      <div className={cn("relative flex-1", viewMode === 'cards' && "overflow-y-auto")}>
        <Container className="pb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-500/20 border-t-accent-500" />
                  <p className="font-mono text-sm text-gray-500">Loading your library...</p>
                </div>
              </div>
            ) : viewMode === 'table' ? (
              <SongTable songs={filteredSongs} onSongClick={handleSongClick} />
            ) : (
              <SongCards songs={filteredSongs} onSongClick={handleSongClick} />
            )}
          </motion.div>
        </Container>
      </div>
    </div>
  )

  return (
    <PanelLayout
      library={libraryContent}
      studio={
        selectedSong ? (
          <StudioPanel
            song={selectedSong}
            onClose={handleCloseStudio}
            onStemSelect={handleStemSelect}
          />
        ) : null
      }
      transcription={
        selectedSong && selectedStem ? (
          <TranscriptionPanel
            stemType={selectedStem}
            songId={selectedSong.song_id}
            onClose={handleCloseTranscription}
          />
        ) : null
      }
      onCloseStudio={handleCloseStudio}
      onCloseTranscription={handleCloseTranscription}
    />
  )
}

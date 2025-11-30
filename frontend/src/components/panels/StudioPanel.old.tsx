import { Song } from '@/types/song'
import { cn } from '@/utils'
import { useState, useEffect } from 'react'

// Studio components
import { StudioHeader } from '@/components/studio/StudioHeader'
import { StemMixer } from '@/components/studio/StemMixer'
import { StemVisualizer } from '@/components/studio/StemVisualizer'
import { LyricsPanel } from '@/components/studio/LyricsPanel'
import { PlaybackControls } from '@/components/studio/PlaybackControls'

// Types
import {
  StemState,
  StemType,
  PlaybackState,
  VisualizerState,
  LyricsState,
  OverlayType,
  VisualizerView,
  LyricLine,
} from '@/components/studio/types'

// Hooks and utilities
import { useAudioPlayback } from '@/hooks/useAudioPlayback'
import { parseLRC } from '@/utils/lrcParser'

// API
import { libraryApi, convertApi, analysisApi, stemsApi } from '@/services/api'

interface StudioPanelProps {
  song: Song
  onClose: () => void
  onStemSelect?: (stemType: string) => void
  className?: string
}

export function StudioPanel({ song, onClose, onStemSelect, className }: StudioPanelProps) {
  // Get available stems from song
  const availableStems = song.has_stems
    ? (Object.keys(song.stem_files).filter((stem) => song.stem_files[stem]) as StemType[])
    : []

  // Initialize stems state
  const [stems, setStems] = useState<StemState[]>(
    (availableStems.length > 0 ? availableStems : (['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'] as StemType[])).map((type) => ({
      type,
      muted: false,
      solo: false,
      volume: 0.8,
    }))
  )

  // Audio playback hook
  const audio = useAudioPlayback({
    onTimeUpdate: (time) => {
      setPlaybackState((prev) => ({ ...prev, currentTime: time }))
    },
    onEnded: () => {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }))
    },
  })

  // Playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: song.duration || 0,
    speed: 1.0,
    loopEnabled: false,
    loopStart: null,
    loopEnd: null,
    metronomeEnabled: false,
    masterVolume: 0.8,
    maxVolume: 1.0,
  })

  // Visualizer state
  const [visualizerState, setVisualizerState] = useState<VisualizerState>({
    view: 'waveform',
    overlays: new Set<OverlayType>(['beats']),
  })

  // Lyrics state
  const [lyricsState, setLyricsState] = useState<LyricsState>({
    autoScroll: true,
    offset: 0,
  })

  // Data loading state
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  const [staticLyrics, setStaticLyrics] = useState<string | undefined>(undefined)
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Load audio, lyrics, and analysis data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)

      try {
        // Load audio
        if (song.has_stems && availableStems.length > 0) {
          // Load all stems
          for (const stemType of availableStems) {
            const stemUrl = await libraryApi.getStemUrl(song.song_id, stemType)
            await audio.loadStem(stemType, stemUrl)
          }
        } else if (song.has_audio) {
          // Load full mix
          const audioUrl = await libraryApi.getAudioUrl(song.song_id)
          await audio.loadFullMix(audioUrl)
        }

        // Update duration from loaded audio
        setPlaybackState((prev) => ({ ...prev, duration: audio.duration }))

        // Load lyrics
        if (song.has_synced_lyrics || song.has_lyrics) {
          try {
            const lyricsData = await libraryApi.getLyrics(song.song_id)

            if (lyricsData.synced) {
              const parsedLyrics = parseLRC(lyricsData.synced)
              setLyrics(parsedLyrics)
            } else if (lyricsData.plain) {
              setStaticLyrics(lyricsData.plain)
            }
          } catch (error) {
            console.error('Failed to load lyrics:', error)
          }
        }

        // Load analysis data (for future use - overlays, etc.)
        if (song.has_analysis) {
          try {
            await libraryApi.getAnalysis(song.song_id)
            // TODO: Use analysis data for beat/chord/section overlays
          } catch (error) {
            console.error('Failed to load analysis:', error)
          }
        }
      } catch (error) {
        console.error('Failed to load studio data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()

    return () => {
      audio.reset()
    }
  }, [song.song_id])

  // Sync playback state
  useEffect(() => {
    setPlaybackState((prev) => ({
      ...prev,
      isPlaying: audio.isPlaying,
      currentTime: audio.currentTime,
      duration: audio.duration,
    }))
  }, [audio.isPlaying, audio.currentTime, audio.duration])

  // Update audio volumes when stems change
  useEffect(() => {
    stems.forEach((stem) => {
      const volume = stem.muted ? 0 : stem.volume
      audio.setStemVolume(stem.type, volume)
    })
  }, [stems, audio])

  // Handlers
  const handleStemUpdate = (type: StemType, updates: Partial<StemState>) => {
    setStems((prev) => prev.map((stem) => (stem.type === type ? { ...stem, ...updates } : stem)))
  }

  const handleStemClick = (type: StemType) => {
    onStemSelect?.(type)
  }

  const handlePlayPause = () => {
    audio.togglePlayPause()
  }

  const handleSeek = (time: number) => {
    audio.seek(time)
  }

  const handleSpeedChange = (speed: number) => {
    audio.setSpeed(speed)
    setPlaybackState((prev) => ({ ...prev, speed }))
  }

  const handleLoopToggle = () => {
    setPlaybackState((prev) => ({ ...prev, loopEnabled: !prev.loopEnabled }))
  }

  const handleSetLoopStart = () => {
    setPlaybackState((prev) => ({ ...prev, loopStart: prev.currentTime }))
  }

  const handleSetLoopEnd = () => {
    setPlaybackState((prev) => ({ ...prev, loopEnd: prev.currentTime }))
  }

  const handleClearLoop = () => {
    setPlaybackState((prev) => ({ ...prev, loopStart: null, loopEnd: null }))
  }

  const handleMetronomeToggle = () => {
    setPlaybackState((prev) => ({ ...prev, metronomeEnabled: !prev.metronomeEnabled }))
  }

  const handleMasterVolumeChange = (volume: number) => {
    audio.setMasterVolume(volume)
    setPlaybackState((prev) => ({ ...prev, masterVolume: volume }))
  }

  const handleMaxVolumeChange = (maxVolume: number) => {
    audio.setMaxVolume(maxVolume)
    setPlaybackState((prev) => ({ ...prev, maxVolume }))
  }

  const handleViewChange = (view: VisualizerView) => {
    setVisualizerState((prev) => ({ ...prev, view }))
  }

  const handleOverlayToggle = (overlay: OverlayType) => {
    setVisualizerState((prev) => {
      const newOverlays = new Set(prev.overlays)
      if (newOverlays.has(overlay)) {
        newOverlays.delete(overlay)
      } else {
        newOverlays.add(overlay)
      }
      return { ...prev, overlays: newOverlays }
    })
  }

  const handleAutoScrollToggle = () => {
    setLyricsState((prev) => ({ ...prev, autoScroll: !prev.autoScroll }))
  }

  const handleOffsetChange = (offset: number) => {
    setLyricsState((prev) => ({ ...prev, offset }))
  }

  // Action handlers - wire to backend APIs
  const handleConvert = async () => {
    try {
      const response = await convertApi.convert({
        input_path: song.audio_file,
        output_format: 'wav',
      })
      console.log('Conversion started:', response.job_id)
      // TODO: Show job status notification
    } catch (error) {
      console.error('Convert failed:', error)
    }
  }

  const handleAnalyze = async () => {
    try {
      const inputPath = song.converted_file || song.audio_file
      const response = await analysisApi.analyze({
        input_path: inputPath,
        preset: 'default',
      })
      console.log('Analysis started:', response.job_id)
      // TODO: Show job status notification
    } catch (error) {
      console.error('Analysis failed:', error)
    }
  }

  const handleSeparateStems = async (model: '2stem' | '4stem' | '6stem') => {
    try {
      const inputPath = song.converted_file || song.audio_file
      const stemsMap = { '2stem': 2, '4stem': 4, '6stem': 6 }

      const response = await stemsApi.separate({
        input_path: inputPath,
        model: `htdemucs`,
        stems: stemsMap[model],
      })
      console.log('Stem separation started:', response.job_id)
      // TODO: Show job status notification
    } catch (error) {
      console.error('Stem separation failed:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await libraryApi.deleteSong(song.song_id)
      console.log('Song deleted')
      onClose()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handlePrevious = () => {
    // TODO: Implement previous track navigation
    console.log('Previous track')
  }

  const handleNext = () => {
    // TODO: Implement next track navigation
    console.log('Next track')
  }

  if (isLoadingData) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-500 border-t-transparent" />
          <p className="font-sans text-sm text-gray-400">Loading studio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <StudioHeader
        song={song}
        onClose={onClose}
        onConvert={handleConvert}
        onAnalyze={handleAnalyze}
        onSeparateStems={handleSeparateStems}
        onDelete={handleDelete}
      />

      {/* Main Content - Three Column Layout */}
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {/* Left: Stem Mixer */}
        <div className="w-[280px] flex-shrink-0 overflow-y-auto">
          <StemMixer
            stems={stems}
            onStemUpdate={handleStemUpdate}
            onStemClick={handleStemClick}
            masterVolume={playbackState.masterVolume}
            maxVolume={playbackState.maxVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            onMaxVolumeChange={handleMaxVolumeChange}
          />
        </div>

        {/* Center: Visualizer */}
        <div className="flex-1 overflow-y-auto">
          <StemVisualizer
            stems={stems}
            view={visualizerState.view}
            overlays={visualizerState.overlays}
            currentTime={playbackState.currentTime}
            duration={playbackState.duration}
            loopStart={playbackState.loopStart}
            loopEnd={playbackState.loopEnd}
            onViewChange={handleViewChange}
            onOverlayToggle={handleOverlayToggle}
            onSeek={handleSeek}
            onStemClick={handleStemClick}
          />
        </div>

        {/* Right: Lyrics */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto">
          <LyricsPanel
            lyrics={lyrics}
            staticLyrics={staticLyrics}
            currentTime={playbackState.currentTime}
            lyricsState={lyricsState}
            onAutoScrollToggle={handleAutoScrollToggle}
            onOffsetChange={handleOffsetChange}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* Bottom: Playback Controls */}
      <PlaybackControls
        playbackState={playbackState}
        onPlayPause={handlePlayPause}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onLoopToggle={handleLoopToggle}
        onSetLoopStart={handleSetLoopStart}
        onSetLoopEnd={handleSetLoopEnd}
        onClearLoop={handleClearLoop}
        onMetronomeToggle={handleMetronomeToggle}
        onMasterVolumeChange={handleMasterVolumeChange}
      />
    </div>
  )
}

import { Song } from '@/types/song'
import { cn } from '@/utils'
import { useState, useEffect } from 'react'

// Studio components
import { StudioHeader } from '@/components/studio/StudioHeader'
import { StemMixer } from '@/components/studio/StemMixer'
import { StemVisualizer } from '@/components/studio/StemVisualizer'
import { LyricsPanel } from '@/components/studio/LyricsPanel'
import { PlaybackControls } from '@/components/studio/PlaybackControls'
import { TranscriptionPanel } from '@/components/panels/TranscriptionPanel'
import { ToastContainer } from '@/components/ui/Toast'
import { JobTracker } from '@/components/ui/JobTracker'
import { JobHistory } from '@/components/ui/JobHistory'

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
import { useSimpleAudioPlayback } from '@/hooks/useSimpleAudioPlayback'
import { useToast } from '@/hooks/useToast'
import { useJobTracker } from '@/hooks/useJobTracker'
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
    (availableStems.length > 0 ? availableStems : ['vocals'] as StemType[]).map((type) => ({
      type,
      muted: false,
      solo: false,
      volume: 0.8,
    }))
  )

  // Toast notifications
  const toast = useToast()

  // Job tracking
  const { activeJobs, jobHistory, addJob, dismissJob, completeJob, failJob, clearHistory } = useJobTracker()

  // Audio playback hook (using simple HTMLAudioElement version)
  const audio = useSimpleAudioPlayback({
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
    overlays: new Set<OverlayType>(['sections']),
  })

  // Lyrics state
  const [lyricsState, setLyricsState] = useState<LyricsState>({
    autoScroll: true,
    offset: 0,
  })

  // Data loading state
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  const [staticLyrics, setStaticLyrics] = useState<string | undefined>(undefined)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Transcription panel state
  const [transcriptionPanelOpen, setTranscriptionPanelOpen] = useState(false)
  const [selectedStem, setSelectedStem] = useState<StemType | null>(null)

  // Load audio, lyrics, and analysis data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true)
      setLoadError(null)

      try {
        if (!song.has_audio && !song.has_converted && !song.has_stems) {
          setLoadError('No audio file available for this song')
          return
        }

        // Load audio - prefer stems for mixing, fallback to full mix
        if (song.has_stems && availableStems.length > 0) {
          console.log('[StudioPanel] Loading individual stems in parallel:', availableStems)

          // Load all stems in parallel for faster loading
          const stemLoadPromises = availableStems.map(async (stemType) => {
            const stemUrl = await libraryApi.getStemUrl(song.song_id, stemType)
            console.log(`[StudioPanel] ⏳ Loading stem ${stemType}...`)
            try {
              await audio.loadStem(stemType, stemUrl)
              console.log(`[StudioPanel] ✓ Loaded ${stemType}`)
            } catch (error) {
              console.error(`[StudioPanel] ❌ Failed to load ${stemType}:`, error)
              throw error
            }
          })

          // Wait for all stems to load
          await Promise.all(stemLoadPromises)
        } else {
          // No stems available - load full mix
          console.log('[StudioPanel] Loading full mix (no stems available)')
          const audioUrl = await libraryApi.getAudioUrl(song.song_id)
          await audio.loadFullMix(audioUrl)
        }

        // Wait a bit for duration to update
        await new Promise(resolve => setTimeout(resolve, 100))

        // Update duration from loaded audio
        console.log('[StudioPanel] Final duration:', audio.duration)
        setPlaybackState((prev) => ({ ...prev, duration: audio.duration || song.duration || 0 }))

        // Set initial master volume
        audio.setMasterVolume(0.8)
        audio.setMaxVolume(1.0)

        // Load lyrics
        if (song.has_synced_lyrics || song.has_lyrics) {
          try {
            const lyricsData = await libraryApi.getLyrics(song.song_id)
            if (lyricsData.synced) {
              const parsedLyrics = parseLRC(lyricsData.synced)
              setLyrics(parsedLyrics)
            }
            if (lyricsData.plain) {
              setStaticLyrics(lyricsData.plain)
            }
          } catch (error) {
            console.error('[StudioPanel] Failed to load lyrics:', error)
          }
        }

        // Load analysis data
        if (song.has_analysis) {
          try {
            const analysis = await libraryApi.getAnalysis(song.song_id)
            console.log('[StudioPanel] Loaded analysis data:', analysis)
            setAnalysisData(analysis)
          } catch (error) {
            console.error('[StudioPanel] Failed to load analysis:', error)
          }
        }
      } catch (error) {
        console.error('[StudioPanel] Failed to load studio data:', error)
        setLoadError(error instanceof Error ? error.message : 'Failed to load audio')
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()

    return () => {
      audio.reset()
    }
  }, [song.song_id])

  // Sync playback state from audio hook
  useEffect(() => {
    setPlaybackState((prev) => ({
      ...prev,
      isPlaying: audio.isPlaying,
      currentTime: audio.currentTime,
      duration: audio.duration || prev.duration,
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
    setSelectedStem(type)
    setTranscriptionPanelOpen(true)
  }

  const handleTranscriptionToggle = () => {
    if (!transcriptionPanelOpen) {
      // Opening panel - set default stem if none selected
      if (!selectedStem && stems.length > 0) {
        setSelectedStem(stems[0].type)
      }
    }
    setTranscriptionPanelOpen(!transcriptionPanelOpen)
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
      toast.info('Conversion Started', song.title, 3000)
      addJob(response.job_id)
    } catch (error) {
      console.error('[StudioPanel] Convert failed:', error)
      toast.error('Conversion Failed', error instanceof Error ? error.message : String(error))
    }
  }

  const handleAnalyze = async () => {
    try {
      const inputPath = song.converted_file || song.audio_file
      const response = await analysisApi.analyze({
        input_path: inputPath,
        preset: 'full',
      })
      toast.info('Analysis Started', song.title, 3000)
      addJob(response.job_id)
    } catch (error) {
      console.error('[StudioPanel] Analysis failed:', error)
      toast.error('Analysis Failed', error instanceof Error ? error.message : String(error))
    }
  }

  const handleSeparateStems = async () => {
    try {
      const inputPath = song.converted_file || song.audio_file

      const response = await stemsApi.separate({
        input_path: inputPath,
        model: 'htdemucs_6s',
        stems: ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'],
        shifts: 2,
      })
      toast.info('Stem Separation Started', song.title, 3000)
      addJob(response.job_id)
    } catch (error) {
      console.error('[StudioPanel] Stem separation failed:', error)
      toast.error('Stem Separation Failed', error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = async () => {
    try {
      await libraryApi.deleteSong(song.song_id)
      onClose()
    } catch (error) {
      console.error('[StudioPanel] Delete failed:', error)
      alert(`Delete failed: ${error}`)
    }
  }

  const handlePrevious = () => {}

  const handleNext = () => {}

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

  if (loadError) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="text-center">
          <p className="mb-4 font-sans text-sm text-red-400">{loadError}</p>
          <button
            onClick={onClose}
            className="rounded bg-accent-500/20 px-4 py-2 text-sm text-accent-400 hover:bg-accent-500/30"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full flex-col relative', className)}>
      {/* Header */}
      <StudioHeader
        song={song}
        onClose={onClose}
        onConvert={handleConvert}
        onAnalyze={handleAnalyze}
        onSeparateStems={handleSeparateStems}
        onDelete={handleDelete}
      />

      {/* Debug Info */}
      <div className="border-b border-white/5 bg-yellow-900/20 p-2">
        <details className="font-mono text-xs text-yellow-400">
          <summary className="cursor-pointer">Debug Info (click to expand)</summary>
          <div className="mt-2 space-y-1">
            <div>Audio loaded: {audio.duration > 0 ? 'YES' : 'NO'}</div>
            <div>Duration: {audio.duration.toFixed(2)}s</div>
            <div>Is playing: {audio.isPlaying ? 'YES' : 'NO'}</div>
            <div>Current time: {audio.currentTime.toFixed(2)}s</div>
            <div>Stems: {stems.length}</div>
            <div>Lyrics: {lyrics ? `${lyrics.length} lines` : staticLyrics ? 'Static' : 'None'}</div>
          </div>
        </details>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {/* Left: Stem Mixer + Transcription Toggle */}
        <div className="w-[280px] flex-shrink-0 overflow-y-auto">
          {/* Transcription Toggle Button */}
          <button
            onClick={handleTranscriptionToggle}
            className={cn(
              'mb-3 w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-sans text-sm font-medium transition-all shadow-sm',
              transcriptionPanelOpen
                ? 'border-accent-500 bg-accent-500/20 text-accent-400 shadow-accent-500/20'
                : 'border-white/20 bg-dark-300/50 text-white hover:border-accent-500/40 hover:bg-accent-500/10 hover:text-accent-400'
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Transcription
          </button>

          <StemMixer
            stems={stems}
            onStemUpdate={handleStemUpdate}
            masterVolume={playbackState.masterVolume}
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
            analysisData={analysisData}
            songId={song.song_id}
            onViewChange={handleViewChange}
            onOverlayToggle={handleOverlayToggle}
            onSeek={handleSeek}
          />
        </div>

        {/* Right: Lyrics */}
        <div className="w-[300px] flex-shrink-0 overflow-y-auto">
          <LyricsPanel
            songId={song.song_id}
            lyrics={lyrics}
            staticLyrics={staticLyrics}
            currentTime={playbackState.currentTime}
            isPlaying={playbackState.isPlaying}
            lyricsState={lyricsState}
            onAutoScrollToggle={handleAutoScrollToggle}
            onOffsetChange={handleOffsetChange}
            onSeek={handleSeek}
            onLyricsUpdate={async () => {
              // Reload lyrics after save
              try {
                const lyricsData = await libraryApi.getLyrics(song.song_id)
                if (lyricsData.synced) {
                  const parsedLyrics = parseLRC(lyricsData.synced)
                  setLyrics(parsedLyrics)
                }
                if (lyricsData.plain) {
                  setStaticLyrics(lyricsData.plain)
                }
                toast.success('Lyrics Saved', 'Lyrics updated successfully')
              } catch (error) {
                console.error('[StudioPanel] Failed to reload lyrics:', error)
              }
            }}
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Job Trackers and History */}
      <div className="fixed bottom-6 right-6 z-[9998] w-96 space-y-3">
        {/* Active job trackers */}
        {activeJobs.map((jobId) => {
          // Determine action name from job type
          const getActionName = (jobType?: string) => {
            if (!jobType) return undefined
            const typeMap: Record<string, string> = {
              'convert': 'Convert to WAV',
              'analysis': 'Full Analysis',
              'stem_separation': 'Stem Separation',
            }
            return typeMap[jobType] || jobType.replace('_', ' ')
          }

          return (
            <JobTracker
              key={jobId}
              jobId={jobId}
              songName={song.title}
              actionName={undefined} // Will be set once job data loads
              onComplete={(job) => {
                const actionName = getActionName(job.job_type)
                toast.success('Completed', `${song.title} - ${actionName}`)
                completeJob(jobId, job.job_type, song.title, actionName)
              }}
              onError={(job) => {
                const actionName = getActionName(job.job_type)
                toast.error('Failed', `${song.title} - ${actionName}`)
                failJob(jobId, job.job_type, job.error || undefined, song.title, actionName)
              }}
              onDismiss={(jobId) => {
                dismissJob(jobId, song.title, 'Job')
              }}
            />
          )
        })}

        {/* Job history - collapsible action log */}
        <JobHistory history={jobHistory} onClear={clearHistory} />
      </div>

      {/* Overlay backdrop when transcription panel is open */}
      {transcriptionPanelOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
          onClick={() => setTranscriptionPanelOpen(false)}
        />
      )}

      {/* Sliding Transcription Panel - from left */}
      <div
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[9999] w-screen bg-dark-400 shadow-2xl transition-transform duration-300 ease-in-out border-r border-white/10 overflow-hidden',
          transcriptionPanelOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {selectedStem && (
          <TranscriptionPanel
            stemType={selectedStem}
            songId={song.song_id}
            onClose={() => setTranscriptionPanelOpen(false)}
            onStemChange={setSelectedStem}
            availableStems={stems.map(s => s.type)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Simple audio playback hook using HTMLAudioElement
 *
 * Simpler than Web Audio API - uses standard HTML5 audio elements
 * which handle loading, decoding, and CORS automatically
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { StemType } from '@/components/studio/types'

interface StemAudio {
  element: HTMLAudioElement
  gainNode?: GainNode
}

interface UseSimpleAudioPlaybackOptions {
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
}

export function useSimpleAudioPlayback(options: UseSimpleAudioPlaybackOptions = {}) {
  const stemAudiosRef = useRef<Map<StemType, StemAudio>>(new Map())
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const timeUpdateAnimationRef = useRef<number | null>(null)
  const masterVolumeRef = useRef<number>(0.8)
  const maxVolumeRef = useRef<number>(1.0)

  /**
   * Load audio for a specific stem
   */
  const loadStem = useCallback(async (stemType: StemType, url: string) => {
    console.log(`[SimpleAudio] Loading ${stemType}:`, url)

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio()
      let timeoutId: number | null = null
      let progressCheckId: number | null = null
      let lastReadyState = -1
      let noProgressCount = 0

      // IMPORTANT: Set crossOrigin BEFORE any src operations
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'

      // Set up event listeners
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (progressCheckId) {
          clearInterval(progressCheckId)
          progressCheckId = null
        }
        audio.removeEventListener('loadedmetadata', handleLoaded)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('error', handleError)
        audio.removeEventListener('loadstart', handleLoadStart)
        audio.removeEventListener('progress', handleProgress)
      }

      const handleLoadStart = () => {
        console.log(`[SimpleAudio] ▶ Load started for ${stemType}`)
      }

      const handleProgress = () => {
        console.log(`[SimpleAudio] ⏳ Loading ${stemType}... readyState: ${audio.readyState}, networkState: ${audio.networkState}`)
        // Reset no-progress counter on progress event
        lastReadyState = audio.readyState
        noProgressCount = 0
      }

      const handleLoaded = () => {
        console.log(`[SimpleAudio] ✓ Loaded ${stemType} - duration: ${audio.duration}s`)

        // Update duration to longest stem
        if (audio.duration > duration) {
          setDuration(audio.duration)
        }

        setIsLoaded(true)
        cleanup()
        resolve()
      }

      const handleCanPlay = () => {
        // Sometimes loadedmetadata doesn't fire but canplay does
        if (audio.duration > 0) {
          console.log(`[SimpleAudio] ✓ Loaded ${stemType} - duration: ${audio.duration}s`)
          if (audio.duration > duration) {
            setDuration(audio.duration)
          }
          setIsLoaded(true)
          cleanup()
          resolve()
        }
      }

      const handleError = (e: Event) => {
        console.error(`[SimpleAudio] ❌ Failed to load ${stemType}:`, {
          error: audio.error?.message,
          code: audio.error?.code,
          url: url,
          networkState: audio.networkState,
          readyState: audio.readyState,
        })

        cleanup()
        reject(new Error(`Failed to load audio: ${audio.error?.message || 'Unknown error'}`))
      }

      // Check progress every 3 seconds - timeout only if NO progress
      progressCheckId = window.setInterval(() => {
        const currentReadyState = audio.readyState
        console.log(`[SimpleAudio] 🔍 Progress check for ${stemType} - readyState: ${currentReadyState}, networkState: ${audio.networkState}`)

        // Check if readyState has progressed
        if (currentReadyState === lastReadyState) {
          noProgressCount++
          console.log(`[SimpleAudio] ⚠️ No progress for ${stemType} - count: ${noProgressCount}/10`)

          // Timeout after 10 checks with no progress (30 seconds total)
          if (noProgressCount >= 10) {
            console.error(`[SimpleAudio] ⏱️ Timeout loading ${stemType} - no progress for 30s. ReadyState: ${currentReadyState}, NetworkState: ${audio.networkState}`)
            cleanup()
            reject(new Error(`Timeout loading audio - no progress for 30 seconds. ReadyState: ${currentReadyState}, NetworkState: ${audio.networkState}`))
          }
        } else {
          // Progress detected, reset counter
          lastReadyState = currentReadyState
          noProgressCount = 0
        }
      }, 3000)

      // Overall timeout after 60 seconds (fallback)
      timeoutId = window.setTimeout(() => {
        console.error(`[SimpleAudio] ⏱️ Hard timeout loading ${stemType} after 60s - readyState: ${audio.readyState}, networkState: ${audio.networkState}`)
        cleanup()
        reject(new Error(`Hard timeout loading audio after 60 seconds. ReadyState: ${audio.readyState}, NetworkState: ${audio.networkState}`))
      }, 60000)

      audio.addEventListener('loadedmetadata', handleLoaded)
      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('error', handleError)
      audio.addEventListener('loadstart', handleLoadStart)
      audio.addEventListener('progress', handleProgress)

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        options.onEnded?.()
      })

      // Store audio element BEFORE setting src
      stemAudiosRef.current.set(stemType, { element: audio })

      // Set source and start loading
      try {
        audio.src = url
        audio.load()
      } catch (err) {
        console.error(`[SimpleAudio] Exception while setting src:`, err)
        cleanup()
        reject(err)
      }
    })
  }, [duration, options])

  /**
   * Load full mix (use 'vocals' as placeholder)
   */
  const loadFullMix = useCallback(async (url: string) => {
    await loadStem('vocals', url)
  }, [loadStem])

  /**
   * Start time update polling (using requestAnimationFrame for smooth updates)
   */
  const startTimeUpdates = useCallback(() => {
    if (timeUpdateAnimationRef.current) {
      return
    }

    const updateTime = () => {
      // Get time from first audio element
      const firstAudio = Array.from(stemAudiosRef.current.values())[0]
      if (firstAudio?.element) {
        const time = firstAudio.element.currentTime
        setCurrentTime(time)
        options.onTimeUpdate?.(time)
      }

      // Continue animation loop
      timeUpdateAnimationRef.current = window.requestAnimationFrame(updateTime)
    }

    // Start the animation loop
    timeUpdateAnimationRef.current = window.requestAnimationFrame(updateTime)
  }, [options])

  /**
   * Stop time update polling
   */
  const stopTimeUpdates = useCallback(() => {
    if (timeUpdateAnimationRef.current) {
      window.cancelAnimationFrame(timeUpdateAnimationRef.current)
      timeUpdateAnimationRef.current = null
    }
  }, [])

  /**
   * Play all loaded stems
   */
  const play = useCallback(() => {
    const audios = Array.from(stemAudiosRef.current.values())

    if (audios.length === 0) {
      console.warn('[SimpleAudio] No audio loaded!')
      return
    }

    // Play all stems
    audios.forEach(({ element }) => {
      element.play()
        .catch(err => {
          console.error(`[SimpleAudio] Play failed:`, err)
        })
    })

    setIsPlaying(true)
    startTimeUpdates()
  }, [startTimeUpdates])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    stemAudiosRef.current.forEach(({ element }) => {
      element.pause()
    })

    setIsPlaying(false)
    stopTimeUpdates()
  }, [stopTimeUpdates])

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  /**
   * Seek to a specific time
   */
  const seek = useCallback((time: number) => {
    stemAudiosRef.current.forEach(({ element }) => {
      element.currentTime = time
    })

    setCurrentTime(time)
  }, [])

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    stemAudiosRef.current.forEach(({ element }) => {
      element.playbackRate = speed
    })
  }, [])

  /**
   * Set stem volume (0-1)
   */
  const setStemVolume = useCallback((stemType: StemType, volume: number) => {
    const stemAudio = stemAudiosRef.current.get(stemType)
    if (stemAudio) {
      const finalVolume = volume * masterVolumeRef.current * maxVolumeRef.current
      stemAudio.element.volume = Math.min(1, Math.max(0, finalVolume))
    }
  }, [])

  /**
   * Set stem mute
   */
  const setStemMute = useCallback((stemType: StemType, muted: boolean) => {
    const stemAudio = stemAudiosRef.current.get(stemType)
    if (stemAudio) {
      stemAudio.element.muted = muted
    }
  }, [])

  /**
   * Set master volume (0-1)
   */
  const setMasterVolume = useCallback((volume: number) => {
    masterVolumeRef.current = volume

    // Update all stem volumes
    stemAudiosRef.current.forEach((stemAudio, stemType) => {
      const stemVolume = stemAudio.element.volume / (masterVolumeRef.current * maxVolumeRef.current)
      setStemVolume(stemType, stemVolume)
    })
  }, [setStemVolume])

  /**
   * Set max volume/limiter (0-1)
   */
  const setMaxVolume = useCallback((volume: number) => {
    maxVolumeRef.current = volume

    // Update all stem volumes
    stemAudiosRef.current.forEach((stemAudio, stemType) => {
      const stemVolume = stemAudio.element.volume / (masterVolumeRef.current * maxVolumeRef.current)
      setStemVolume(stemType, stemVolume)
    })
  }, [setStemVolume])

  /**
   * Get analyser node (not supported in simple mode)
   */
  const getAnalyser = useCallback((): null => {
    console.warn('[SimpleAudio] Analyser not available in simple mode')
    return null
  }, [])

  /**
   * Unload all stems and reset
   */
  const reset = useCallback(() => {
    // Stop time updates
    if (timeUpdateAnimationRef.current) {
      window.cancelAnimationFrame(timeUpdateAnimationRef.current)
      timeUpdateAnimationRef.current = null
    }

    // Remove all audio elements
    stemAudiosRef.current.forEach(({ element }) => {
      element.pause()
      element.src = ''
      element.load()
    })

    stemAudiosRef.current.clear()
    setCurrentTime(0)
    setDuration(0)
    setIsLoaded(false)
    setIsPlaying(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimeUpdates()
      reset()
    }
  }, [stopTimeUpdates, reset])

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    isLoaded,

    // Load functions
    loadStem,
    loadFullMix,

    // Playback controls
    play,
    pause,
    togglePlayPause,
    seek,
    setSpeed,

    // Volume controls
    setStemVolume,
    setStemMute,
    setMasterVolume,
    setMaxVolume,

    // Visualization (not available)
    getAnalyser,

    // Utility
    reset,
  }
}

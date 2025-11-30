/**
 * Multi-stem audio playback hook using Web Audio API
 *
 * Manages synchronized playback of multiple audio stems with individual
 * volume, mute, and solo controls.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { StemType } from '@/components/studio/types'

interface StemAudioNode {
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  gainNode: GainNode
}

interface UseAudioPlaybackOptions {
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const stemNodesRef = useRef<Map<StemType, StemAudioNode>>(new Map())
  const masterGainRef = useRef<GainNode | null>(null)
  const maxGainRef = useRef<GainNode | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const playbackStartTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const playbackRateRef = useRef<number>(1.0)

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new AudioContext()

    // Create master gain (volume control)
    masterGainRef.current = audioContextRef.current.createGain()

    // Create max gain (limiter)
    maxGainRef.current = audioContextRef.current.createGain()

    // Chain: stems → master → max → destination
    masterGainRef.current.connect(maxGainRef.current)
    maxGainRef.current.connect(audioContextRef.current.destination)

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Time update loop
  const updateTime = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return

    const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current
    const newTime = pausedAtRef.current + elapsed * playbackRateRef.current

    if (newTime >= duration) {
      // Playback ended
      setIsPlaying(false)
      setCurrentTime(duration)
      options.onEnded?.()
      return
    }

    setCurrentTime(newTime)
    options.onTimeUpdate?.(newTime)
    animationFrameRef.current = requestAnimationFrame(updateTime)
  }, [isPlaying, duration, options])

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime)
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, updateTime])

  /**
   * Load audio buffer for a specific stem
   */
  const loadStem = useCallback(async (stemType: StemType, url: string) => {
    if (!audioContextRef.current || !masterGainRef.current) return

    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

      // Create gain node for this stem
      const gainNode = audioContextRef.current.createGain()
      gainNode.connect(masterGainRef.current)

      // Store stem audio node
      stemNodesRef.current.set(stemType, {
        buffer: audioBuffer,
        source: null,
        gainNode,
      })

      // Update duration to the longest stem
      if (audioBuffer.duration > duration) {
        setDuration(audioBuffer.duration)
      }
    } catch (error) {
      console.error(`Failed to load stem ${stemType}:`, error)
    }
  }, [duration])

  /**
   * Load full mix audio
   */
  const loadFullMix = useCallback(async (url: string) => {
    // Use 'vocals' as a placeholder for full mix
    await loadStem('vocals', url)
  }, [loadStem])

  /**
   * Play all loaded stems
   */
  const play = useCallback(() => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current

    // Resume AudioContext if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    playbackStartTimeRef.current = ctx.currentTime

    // Create and start source nodes for all stems
    stemNodesRef.current.forEach((stemNode) => {
      if (!stemNode.buffer) return

      const source = ctx.createBufferSource()
      source.buffer = stemNode.buffer
      source.playbackRate.value = playbackRateRef.current
      source.connect(stemNode.gainNode)

      // Start from paused position
      source.start(0, pausedAtRef.current)
      stemNode.source = source
    })

    setIsPlaying(true)
  }, [])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return

    // Stop all sources
    stemNodesRef.current.forEach((stemNode) => {
      if (stemNode.source) {
        stemNode.source.stop()
        stemNode.source = null
      }
    })

    // Save current position
    pausedAtRef.current = currentTime

    setIsPlaying(false)
  }, [isPlaying, currentTime])

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
    const wasPlaying = isPlaying

    // Stop current playback
    if (isPlaying) {
      pause()
    }

    // Update position
    pausedAtRef.current = Math.max(0, Math.min(time, duration))
    setCurrentTime(pausedAtRef.current)

    // Resume if was playing
    if (wasPlaying) {
      // Small delay to ensure state updates
      setTimeout(() => play(), 50)
    }
  }, [isPlaying, duration, pause, play])

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    playbackRateRef.current = speed

    // If playing, restart with new speed
    if (isPlaying) {
      const currentPos = currentTime
      pause()
      pausedAtRef.current = currentPos
      setTimeout(() => play(), 50)
    }
  }, [isPlaying, currentTime, pause, play])

  /**
   * Set stem volume (0-1)
   */
  const setStemVolume = useCallback((stemType: StemType, volume: number) => {
    const stemNode = stemNodesRef.current.get(stemType)
    if (stemNode) {
      stemNode.gainNode.gain.value = volume
    }
  }, [])

  /**
   * Set stem mute
   */
  const setStemMute = useCallback((stemType: StemType, muted: boolean) => {
    setStemVolume(stemType, muted ? 0 : 1)
  }, [setStemVolume])

  /**
   * Set master volume (0-1)
   */
  const setMasterVolume = useCallback((volume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume
    }
  }, [])

  /**
   * Set max volume/limiter (0-1)
   */
  const setMaxVolume = useCallback((volume: number) => {
    if (maxGainRef.current) {
      maxGainRef.current.gain.value = volume
    }
  }, [])

  /**
   * Get analyser node for visualizations
   */
  const getAnalyser = useCallback((stemType?: StemType): AnalyserNode | null => {
    if (!audioContextRef.current) return null

    const ctx = audioContextRef.current
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048

    if (stemType) {
      // Connect specific stem to analyser
      const stemNode = stemNodesRef.current.get(stemType)
      if (stemNode) {
        stemNode.gainNode.connect(analyser)
      }
    } else {
      // Connect master to analyser
      if (masterGainRef.current) {
        masterGainRef.current.connect(analyser)
      }
    }

    return analyser
  }, [])

  /**
   * Unload all stems and reset
   */
  const reset = useCallback(() => {
    // Stop playback
    if (isPlaying) {
      pause()
    }

    // Disconnect and clear all stem nodes
    stemNodesRef.current.forEach((stemNode) => {
      if (stemNode.source) {
        stemNode.source.stop()
      }
      stemNode.gainNode.disconnect()
    })

    stemNodesRef.current.clear()
    setCurrentTime(0)
    pausedAtRef.current = 0
    setDuration(0)
  }, [isPlaying, pause])

  return {
    // State
    isPlaying,
    currentTime,
    duration,

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

    // Visualization
    getAnalyser,

    // Utility
    reset,
  }
}

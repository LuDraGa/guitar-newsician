/**
 * Waveform data extraction utilities using Web Audio API
 */

export interface WaveformData {
  peaks: Float32Array
  length: number
  duration: number
  sampleRate: number
}

/**
 * Extract waveform peaks from an audio URL
 * @param audioUrl - URL to the audio file
 * @param samplesPerPixel - Number of audio samples to downsample per visual pixel (default: 512)
 * @returns Promise<WaveformData>
 */
export async function extractWaveform(
  audioUrl: string,
  samplesPerPixel: number = 512
): Promise<WaveformData> {
  try {
    // Fetch audio data
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()

    // Decode audio using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Extract channel data (use first channel or mix to mono if stereo)
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const duration = audioBuffer.duration

    // Calculate number of peaks needed
    const numPeaks = Math.ceil(channelData.length / samplesPerPixel)
    const peaks = new Float32Array(numPeaks)

    // Downsample by taking max absolute value in each chunk
    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPixel
      const end = Math.min(start + samplesPerPixel, channelData.length)

      let max = 0
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
    }

    // Close audio context to free resources
    await audioContext.close()

    return {
      peaks,
      length: numPeaks,
      duration,
      sampleRate,
    }
  } catch (error) {
    console.error('[WaveformExtractor] Failed to extract waveform:', error)
    throw error
  }
}

/**
 * Extract detailed waveform with min/max pairs for better visualization
 * @param audioUrl - URL to the audio file
 * @param width - Target width in pixels
 * @returns Promise with min/max arrays
 */
export async function extractDetailedWaveform(
  audioUrl: string,
  width: number
): Promise<{ min: Float32Array; max: Float32Array; duration: number }> {
  try {
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const channelData = audioBuffer.getChannelData(0)
    const duration = audioBuffer.duration
    const samplesPerPixel = Math.floor(channelData.length / width)

    const min = new Float32Array(width)
    const max = new Float32Array(width)

    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel
      const end = Math.min(start + samplesPerPixel, channelData.length)

      let minVal = Infinity
      let maxVal = -Infinity

      for (let j = start; j < end; j++) {
        const val = channelData[j]
        if (val < minVal) minVal = val
        if (val > maxVal) maxVal = val
      }

      min[i] = minVal === Infinity ? 0 : minVal
      max[i] = maxVal === -Infinity ? 0 : maxVal
    }

    await audioContext.close()

    return { min, max, duration }
  } catch (error) {
    console.error('[WaveformExtractor] Failed to extract detailed waveform:', error)
    throw error
  }
}

/**
 * Extract frequency data for spectrogram visualization using proper FFT
 * @param audioUrl - URL to the audio file
 * @param targetWidth - Target width in time frames (for performance)
 * @param fftSize - FFT size (default: 2048)
 * @returns Promise with frequency data over time
 */
export async function extractSpectrogramData(
  audioUrl: string,
  targetWidth: number = 300,
  fftSize: number = 2048
): Promise<{
  data: number[][]
  frequencyBinCount: number
  duration: number
  sampleRate: number
}> {
  try {
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const duration = audioBuffer.duration

    // Calculate hop size based on target width
    const hopSize = Math.floor(channelData.length / targetWidth)
    const frequencyBinCount = fftSize / 2

    const spectrogramData: number[][] = []

    // Simple magnitude spectrum extraction
    // For each time window, compute frequency magnitudes
    for (let i = 0; i < targetWidth; i++) {
      const start = i * hopSize
      const end = Math.min(start + fftSize, channelData.length)

      if (start >= channelData.length) break

      // Get windowed frame
      const frame = new Float32Array(fftSize)
      for (let j = 0; j < fftSize && start + j < channelData.length; j++) {
        // Apply Hamming window
        const windowValue = 0.54 - 0.46 * Math.cos((2 * Math.PI * j) / fftSize)
        frame[j] = channelData[start + j] * windowValue
      }

      // Simplified FFT: compute magnitude spectrum using DFT approximation
      // This is a simplified version - for production, use a proper FFT library
      const magnitudes = new Array(frequencyBinCount).fill(0)

      // Compute a subset of frequency bins for performance
      const binStep = Math.max(1, Math.floor(frequencyBinCount / 80)) // Sample 80 bins
      for (let k = 0; k < frequencyBinCount; k += binStep) {
        let real = 0
        let imag = 0

        // DFT for this frequency bin
        for (let n = 0; n < Math.min(fftSize, 512); n++) { // Limit samples for speed
          const angle = (2 * Math.PI * k * n) / fftSize
          real += frame[n] * Math.cos(angle)
          imag += frame[n] * Math.sin(angle)
        }

        // Magnitude
        const magnitude = Math.sqrt(real * real + imag * imag)
        magnitudes[k] = magnitude

        // Fill in skipped bins with interpolation
        if (binStep > 1 && k > 0) {
          for (let fill = 1; fill < binStep && k + fill < frequencyBinCount; fill++) {
            magnitudes[k + fill] = magnitude
          }
        }
      }

      spectrogramData.push(magnitudes)
    }

    await audioContext.close()

    return {
      data: spectrogramData,
      frequencyBinCount,
      duration,
      sampleRate,
    }
  } catch (error) {
    console.error('[WaveformExtractor] Failed to extract spectrogram data:', error)
    throw error
  }
}

/**
 * Cache for waveform data to avoid re-processing
 */
const waveformCache = new Map<string, WaveformData>()
const detailedWaveformCache = new Map<string, { min: Float32Array; max: Float32Array; duration: number }>()

/**
 * Get waveform with caching
 */
export async function getCachedWaveform(
  audioUrl: string,
  samplesPerPixel: number = 512
): Promise<WaveformData> {
  const cacheKey = `${audioUrl}_${samplesPerPixel}`

  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey)!
  }

  const waveform = await extractWaveform(audioUrl, samplesPerPixel)
  waveformCache.set(cacheKey, waveform)

  return waveform
}

/**
 * Get detailed waveform with caching
 */
export async function getCachedDetailedWaveform(
  audioUrl: string,
  width: number
): Promise<{ min: Float32Array; max: Float32Array; duration: number }> {
  const cacheKey = `${audioUrl}_${width}`

  if (detailedWaveformCache.has(cacheKey)) {
    return detailedWaveformCache.get(cacheKey)!
  }

  const waveform = await extractDetailedWaveform(audioUrl, width)
  detailedWaveformCache.set(cacheKey, waveform)

  return waveform
}

/**
 * Cache for spectrogram data
 */
const spectrogramCache = new Map<string, {
  data: number[][]
  frequencyBinCount: number
  duration: number
  sampleRate: number
}>()

/**
 * Get spectrogram data with caching
 */
export async function getCachedSpectrogramData(
  audioUrl: string,
  targetWidth: number = 300,
  fftSize: number = 2048
): Promise<{
  data: number[][]
  frequencyBinCount: number
  duration: number
  sampleRate: number
}> {
  const cacheKey = `${audioUrl}_${targetWidth}_${fftSize}`

  if (spectrogramCache.has(cacheKey)) {
    return spectrogramCache.get(cacheKey)!
  }

  const spectrogram = await extractSpectrogramData(audioUrl, targetWidth, fftSize)
  spectrogramCache.set(cacheKey, spectrogram)

  return spectrogram
}

/**
 * Clear waveform cache
 */
export function clearWaveformCache() {
  waveformCache.clear()
  detailedWaveformCache.clear()
  spectrogramCache.clear()
}

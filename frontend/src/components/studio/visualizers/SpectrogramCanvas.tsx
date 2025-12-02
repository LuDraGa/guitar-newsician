import { useEffect, useRef, useState } from 'react'
import { getCachedSpectrogramData } from '@/utils/waveformExtractor'

interface SpectrogramCanvasProps {
  audioUrl: string
  stemType: string
  color: string
  width: number
  height: number
  className?: string
}

export function SpectrogramCanvas({ audioUrl, stemType, color, width, height, className }: SpectrogramCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spectrogramData, setSpectrogramData] = useState<{
    data: number[][]
    frequencyBinCount: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract spectrogram data on mount or when URL changes
  useEffect(() => {
    let cancelled = false

    async function loadSpectrogram() {
      setIsLoading(true)
      setError(null)

      try {
        // Use lower resolution for faster loading
        const targetWidth = Math.max(Math.floor(width / 3), 200)
        const data = await getCachedSpectrogramData(audioUrl, targetWidth, 2048)
        if (!cancelled) {
          setSpectrogramData(data)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`[SpectrogramCanvas] Failed to load spectrogram for ${stemType}:`, err)
          setError('Failed to load spectrogram')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSpectrogram()

    return () => {
      cancelled = true
    }
  }, [audioUrl, stemType, width])

  // Render spectrogram to canvas when data is ready
  useEffect(() => {
    if (!spectrogramData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    const { data, frequencyBinCount } = spectrogramData
    const numTimeFrames = data.length

    // Find max magnitude for normalization
    let maxMagnitude = 0
    for (const frame of data) {
      for (const mag of frame) {
        if (mag > maxMagnitude) maxMagnitude = mag
      }
    }

    // Render spectrogram as heatmap
    // Show lower frequencies at bottom (more musical)
    const numFreqBins = Math.min(frequencyBinCount, 80) // Limit to 80 frequency bins for display
    const freqStep = Math.max(1, Math.floor(frequencyBinCount / numFreqBins))

    for (let t = 0; t < numTimeFrames; t++) {
      const x = (t / numTimeFrames) * width

      for (let f = 0; f < numFreqBins; f++) {
        // Invert frequency axis so low frequencies are at bottom
        const freqIndex = (numFreqBins - 1 - f) * freqStep
        const magnitude = data[t][freqIndex] || 0
        const normalized = Math.min(1, magnitude / (maxMagnitude * 0.3)) // Scale for better visibility

        // Apply log scale for better perceptual representation
        const logNormalized = Math.log1p(normalized * 10) / Math.log1p(10)

        // Create color based on magnitude using the stem color
        const alpha = Math.pow(logNormalized, 0.7) // Gamma correction for better contrast

        // Parse hex color to RGB
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`

        const cellWidth = Math.ceil(width / numTimeFrames) + 1 // +1 to avoid gaps
        const cellHeight = Math.ceil(height / numFreqBins) + 1

        const y = (f / numFreqBins) * height

        ctx.fillRect(x, y, cellWidth, cellHeight)
      }
    }
  }, [spectrogramData, width, height, color])

  if (isLoading) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color }} />
          <div className="text-xs opacity-50" style={{ color }}>
            Computing spectrogram...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex h-full items-center justify-center text-xs opacity-50">
          {error}
        </div>
      </div>
    )
  }

  return <canvas ref={canvasRef} className={className} style={{ width, height }} />
}

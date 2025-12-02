import { useEffect, useRef, useState } from 'react'
import { getCachedDetailedWaveform } from '@/utils/waveformExtractor'

interface WaveformCanvasProps {
  audioUrl: string
  stemType: string
  color: string
  width: number
  height: number
  className?: string
}

export function WaveformCanvas({ audioUrl, stemType, color, width, height, className }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [waveformData, setWaveformData] = useState<{ min: Float32Array; max: Float32Array } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract waveform data on mount or when URL changes
  useEffect(() => {
    let cancelled = false

    async function loadWaveform() {
      setIsLoading(true)
      setError(null)

      try {
        // Use lower resolution for faster loading (1/3 of width, min 300 samples)
        const targetWidth = Math.max(Math.floor(width / 3), 300)
        const data = await getCachedDetailedWaveform(audioUrl, targetWidth)
        if (!cancelled) {
          setWaveformData(data)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`[WaveformCanvas] Failed to load waveform for ${stemType}:`, err)
          setError('Failed to load waveform')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadWaveform()

    return () => {
      cancelled = true
    }
  }, [audioUrl, stemType, width])

  // Render waveform to canvas when data is ready
  useEffect(() => {
    if (!waveformData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Set waveform style
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = 1

    const { min, max } = waveformData
    const centerY = height / 2
    const amplitudeScale = (height / 2) * 0.9 // 90% of available space

    // Draw waveform as filled shape
    ctx.beginPath()
    ctx.moveTo(0, centerY)

    // Draw top half (max values)
    for (let i = 0; i < min.length; i++) {
      const x = (i / min.length) * width
      const y = centerY - max[i] * amplitudeScale
      ctx.lineTo(x, y)
    }

    // Draw bottom half (min values) in reverse
    for (let i = min.length - 1; i >= 0; i--) {
      const x = (i / min.length) * width
      const y = centerY - min[i] * amplitudeScale
      ctx.lineTo(x, y)
    }

    ctx.closePath()
    ctx.fill()
  }, [waveformData, width, height, color])

  if (isLoading) {
    return (
      <div className={className} style={{ width, height }}>
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color }} />
          <div className="text-xs opacity-50" style={{ color }}>
            Loading waveform...
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

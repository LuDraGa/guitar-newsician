/**
 * MIDIStatus Component
 * Displays MIDI file status and download button
 */

import { Download, FileAudio, CheckCircle } from 'lucide-react'

interface MIDIStatusProps {
  status: 'none' | 'transcribing' | 'transcribed' | 'error'
  midiPath?: string
  notesDetected?: number
  className?: string
}

export function MIDIStatus({ status, midiPath, notesDetected, className }: MIDIStatusProps) {
  const handleDownload = () => {
    if (midiPath) {
      // Construct full URL if midiPath is a relative path
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
      const fullUrl = midiPath.startsWith('http') ? midiPath : `${API_URL}${midiPath}`

      const link = document.createElement('a')
      link.href = fullUrl
      link.download = midiPath.split('/').pop() || 'transcription.mid'
      link.click()
    }
  }

  if (status === 'none') {
    return null
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
        {/* Transcribed State */}
        {status === 'transcribed' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-white">
                  MIDI Transcribed
                </div>
                <div className="font-mono text-xs text-gray-400">
                  {notesDetected} notes detected
                </div>
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-accent-500/20 px-3 py-2 font-mono text-xs text-accent-400 transition-colors hover:bg-accent-500/30"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        )}

        {/* Transcribing State */}
        {status === 'transcribing' && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/20">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold text-white">
                Transcribing Audio...
              </div>
              <div className="font-mono text-xs text-gray-400">
                This may take 10-30 seconds
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <FileAudio className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold text-red-400">
                Transcription Failed
              </div>
              <div className="font-mono text-xs text-gray-400">
                Please check settings and try again
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

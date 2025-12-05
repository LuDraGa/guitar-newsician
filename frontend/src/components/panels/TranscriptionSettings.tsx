/**
 * TranscriptionSettings Component
 * Allows users to configure basic-pitch parameters and trigger transcription
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Settings, Music } from 'lucide-react'
import { midiEditorService, BasicPitchParams, Preset } from '@/services/midiEditorService'

interface TranscriptionSettingsProps {
  songId: string
  stemName: string
  availableStems?: string[]
  onStemChange?: (stem: string) => void
  onTranscribe: (params: BasicPitchParams) => Promise<void>
  status: 'none' | 'transcribing' | 'transcribed' | 'error'
  className?: string
}

const DEFAULT_PARAMS: BasicPitchParams = {
  onset_threshold: 0.5,
  frame_threshold: 0.3,
  minimum_note_length: 58.0,
  minimum_frequency: null,
  maximum_frequency: null,
  melodia_trick: true,
  multiple_pitch_bends: false,
}

export function TranscriptionSettings({
  songId,
  stemName,
  availableStems = [],
  onStemChange,
  onTranscribe,
  status,
  className,
}: TranscriptionSettingsProps) {
  const [params, setParams] = useState<BasicPitchParams>(DEFAULT_PARAMS)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [presets, setPresets] = useState<Record<string, Preset>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  // Load presets on mount
  useEffect(() => {
    loadPresets()
  }, [])

  // Auto-select preset based on stem name
  useEffect(() => {
    if (presets && stemName && presets[stemName.toLowerCase()]) {
      applyPreset(stemName.toLowerCase())
    }
  }, [stemName, presets])

  const loadPresets = async () => {
    try {
      const response = await midiEditorService.getPresets()
      setPresets(response.presets)
    } catch (error) {
      console.error('Failed to load presets:', error)
    }
  }

  const applyPreset = (presetName: string) => {
    if (presets[presetName]) {
      const preset = presets[presetName]
      setParams({
        onset_threshold: preset.onset_threshold,
        frame_threshold: preset.frame_threshold,
        minimum_note_length: 58.0,
        minimum_frequency: preset.minimum_frequency || null,
        maximum_frequency: preset.maximum_frequency || null,
        melodia_trick: preset.melodia_trick,
        multiple_pitch_bends: false,
      })
      setSelectedPreset(presetName)
    }
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetName = e.target.value
    if (presetName === 'custom') {
      setSelectedPreset('custom')
    } else {
      applyPreset(presetName)
    }
  }

  const handleTranscribe = async () => {
    setIsTranscribing(true)
    try {
      await onTranscribe(params)
    } finally {
      setIsTranscribing(false)
    }
  }

  const updateParam = <K extends keyof BasicPitchParams>(
    key: K,
    value: BasicPitchParams[K]
  ) => {
    setParams(prev => ({ ...prev, [key]: value }))
    setSelectedPreset('custom')
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-white/10 bg-dark-300/30 p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-accent-400" />
            <h4 className="font-display text-sm font-semibold text-white">
              Transcription Settings
            </h4>
          </div>
          {status === 'transcribed' && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-mono text-xs text-green-400">
              ✓ Transcribed
            </span>
          )}
        </div>

        {/* Stem Selector (if multiple stems available) */}
        {availableStems.length > 0 && onStemChange && (
          <div className="mb-3">
            <label className="mb-1.5 block font-mono text-xs text-gray-400">
              Stem to Transcribe
            </label>
            <select
              value={stemName}
              onChange={(e) => onStemChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent-500/30"
            >
              {availableStems.map((stem) => (
                <option key={stem} value={stem}>
                  {stem.charAt(0).toUpperCase() + stem.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Preset Selector */}
        <div className="mb-3">
          <label className="mb-1.5 block font-mono text-xs text-gray-400">
            Preset Profile
          </label>
          <select
            value={selectedPreset}
            onChange={handlePresetChange}
            className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent-500/30"
          >
            <option value="custom">Custom Settings</option>
            {Object.entries(presets).map(([key, preset]) => (
              <option key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)} - {preset.description}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/10 bg-dark-400/30 px-3 py-2 text-left transition-colors hover:border-accent-500/30"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-mono text-xs text-gray-300">Advanced Parameters</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {/* Advanced Parameters */}
        {showAdvanced && (
          <div className="mb-4 space-y-3 rounded-lg border border-white/5 bg-dark-400/20 p-3">
            {/* Onset Threshold */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-mono text-xs text-gray-400">Onset Threshold</label>
                <span className="font-mono text-xs text-accent-400">
                  {params.onset_threshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.onset_threshold}
                onChange={e => updateParam('onset_threshold', parseFloat(e.target.value))}
                className="w-full accent-accent-500"
              />
              <p className="mt-1 font-mono text-[10px] text-gray-600">
                Higher = fewer note onsets detected
              </p>
            </div>

            {/* Frame Threshold */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-mono text-xs text-gray-400">Frame Threshold</label>
                <span className="font-mono text-xs text-accent-400">
                  {params.frame_threshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.frame_threshold}
                onChange={e => updateParam('frame_threshold', parseFloat(e.target.value))}
                className="w-full accent-accent-500"
              />
              <p className="mt-1 font-mono text-[10px] text-gray-600">
                Higher = fewer notes overall
              </p>
            </div>

            {/* Minimum Note Length */}
            <div>
              <label className="mb-1.5 block font-mono text-xs text-gray-400">
                Min Note Length (ms)
              </label>
              <input
                type="number"
                min="10"
                max="500"
                step="10"
                value={params.minimum_note_length}
                onChange={e => updateParam('minimum_note_length', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-accent-500/30"
              />
            </div>

            {/* Frequency Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1.5 block font-mono text-xs text-gray-400">
                  Min Freq (Hz)
                </label>
                <input
                  type="number"
                  min="20"
                  max="2000"
                  placeholder="None"
                  value={params.minimum_frequency || ''}
                  onChange={e =>
                    updateParam('minimum_frequency', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-accent-500/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-xs text-gray-400">
                  Max Freq (Hz)
                </label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  placeholder="None"
                  value={params.maximum_frequency || ''}
                  onChange={e =>
                    updateParam('maximum_frequency', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  className="w-full rounded-lg border border-white/10 bg-dark-400/50 px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-accent-500/30"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="font-mono text-xs text-gray-400">Melodia Trick</span>
                <input
                  type="checkbox"
                  checked={params.melodia_trick}
                  onChange={e => updateParam('melodia_trick', e.target.checked)}
                  className="h-4 w-4 accent-accent-500"
                />
              </label>
              <p className="font-mono text-[10px] text-gray-600">
                Enable for monophonic sources (vocals, bass)
              </p>

              <label className="flex items-center justify-between">
                <span className="font-mono text-xs text-gray-400">Multiple Pitch Bends</span>
                <input
                  type="checkbox"
                  checked={params.multiple_pitch_bends}
                  onChange={e => updateParam('multiple_pitch_bends', e.target.checked)}
                  className="h-4 w-4 accent-accent-500"
                />
              </label>
            </div>
          </div>
        )}

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={isTranscribing || status === 'transcribing'}
          className="w-full rounded-lg bg-accent-500/20 px-4 py-2.5 font-display text-sm font-semibold text-accent-400 transition-all hover:bg-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranscribing || status === 'transcribing' ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
              Transcribing...
            </div>
          ) : status === 'transcribed' ? (
            'Re-transcribe'
          ) : (
            'Transcribe to MIDI'
          )}
        </button>

        {/* Error State */}
        {status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="font-mono text-xs text-red-400">
              Transcription failed. Please try again.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

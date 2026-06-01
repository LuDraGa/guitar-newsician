/**
 * TranscriptionHeader Component
 * Compact header with stem selector, transcribe button, and settings dropdown
 */

import { useState, useEffect, useRef } from 'react'
import { Settings, ChevronDown, Music } from 'lucide-react'
import { cn } from '@/utils'
import { midiEditorService, BasicPitchParams, Preset } from '@/services/midiEditorService'

interface TranscriptionHeaderProps {
  songId: string
  stemName: string
  availableStems: string[]
  onStemChange: (stem: string) => void
  onTranscribe: (params: BasicPitchParams) => Promise<void>
  onClose: () => void
  status: 'none' | 'transcribing' | 'transcribed' | 'error'
  notesDetected?: number
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

export function TranscriptionHeader({
  songId,
  stemName,
  availableStems,
  onStemChange,
  onTranscribe,
  onClose,
  status,
  notesDetected,
}: TranscriptionHeaderProps) {
  const [params, setParams] = useState<BasicPitchParams>(DEFAULT_PARAMS)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [presets, setPresets] = useState<Record<string, Preset>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [showStemDropdown, setShowStemDropdown] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const stemDropdownRef = useRef<HTMLDivElement>(null)

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
      if (stemDropdownRef.current && !stemDropdownRef.current.contains(e.target as Node)) {
        setShowStemDropdown(false)
      }
    }

    if (showSettings || showStemDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings, showStemDropdown])

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
      setShowSettings(false)
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
    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 flex-shrink-0 relative z-10">
      {/* Left: Everything grouped together */}
      <div className="flex items-center gap-3">
        {/* Custom Stem Selector + Settings */}
        <div className="flex items-center gap-0 relative">
          {/* Stem Dropdown Button */}
          {availableStems.length > 0 && (
            <div className="relative" ref={stemDropdownRef}>
              <button
                onClick={() => setShowStemDropdown(!showStemDropdown)}
                className="flex items-center gap-2 rounded-l-lg border border-r-0 border-white/10 bg-dark-400/50 pl-3 pr-2 py-2 font-display text-sm font-semibold text-white transition-all hover:border-accent-500/30 hover:bg-dark-400/70 capitalize"
              >
                {stemName}
                <ChevronDown className={cn(
                  "h-4 w-4 text-gray-400 transition-transform",
                  showStemDropdown && "rotate-180"
                )} />
              </button>

              {/* Custom Dropdown Menu */}
              {showStemDropdown && (
                <div className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-dark-300 shadow-2xl z-50 overflow-hidden">
                  {availableStems.map((stem) => (
                    <button
                      key={stem}
                      onClick={() => {
                        onStemChange(stem)
                        setShowStemDropdown(false)
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left font-display text-sm font-medium capitalize transition-colors",
                        stem === stemName
                          ? "bg-accent-500/20 text-accent-400"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {stem}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Button (attached) */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'flex h-[38px] w-10 items-center justify-center rounded-r-lg border border-l-0 transition-all',
                showSettings
                  ? 'border-accent-500/30 bg-accent-500/10 text-accent-400'
                  : 'border-white/10 bg-dark-400/50 text-gray-400 hover:border-accent-500/30 hover:bg-accent-500/10 hover:text-accent-400'
              )}
              title="Transcription settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Settings Dropdown Panel */}
            {showSettings && (
              <div className="absolute left-0 top-full mt-2 w-96 rounded-xl border border-white/10 bg-dark-300 p-4 shadow-2xl z-50">
                <div className="mb-3 flex items-center gap-2">
                  <Music className="h-4 w-4 text-accent-400" />
                  <h4 className="font-display text-sm font-semibold text-white">
                    Transcription Settings
                  </h4>
                </div>

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

                {/* Advanced Parameters */}
                <div className="space-y-3 rounded-lg border border-white/5 bg-dark-400/20 p-3">
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

                  {/* Toggles */}
                  <div className="space-y-2 pt-2">
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {status === 'transcribed' && (
          <span className="rounded-full bg-green-500/20 px-3 py-1.5 font-mono text-xs text-green-400 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {notesDetected ? `${notesDetected} notes` : 'Transcribed'}
          </span>
        )}
        {status === 'error' && (
          <span className="rounded-full bg-red-500/20 px-3 py-1.5 font-mono text-xs text-red-400">
            Error
          </span>
        )}

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={isTranscribing || status === 'transcribing'}
          className="rounded-lg bg-accent-500/20 px-4 py-2 font-display text-sm font-semibold text-accent-400 transition-all hover:bg-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranscribing || status === 'transcribing' ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-400 border-t-transparent" />
              Transcribing...
            </div>
          ) : status === 'transcribed' ? (
            'Re-transcribe'
          ) : (
            'Transcribe'
          )}
        </button>
      </div>

      {/* Right: Close button only */}
      <button
        onClick={onClose}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
        title="Close transcription"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}

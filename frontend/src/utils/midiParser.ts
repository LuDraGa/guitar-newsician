/**
 * MIDI Parser Utility
 * Loads and parses MIDI files for visualization and playback
 */

import { Midi } from '@tonejs/midi'

export interface MIDINote {
  pitch: number // MIDI note number (0-127)
  pitchName: string // e.g., "C4"
  time: number // Start time in seconds
  duration: number // Duration in seconds
  velocity: number // 0-1
}

export interface MIDIParsedData {
  notes: MIDINote[]
  duration: number // Total duration in seconds
  tempo: number // BPM
  timeSignature: [number, number] // e.g., [4, 4]
}

/**
 * Load and parse a MIDI file
 */
export async function parseMIDIFile(midiPath: string): Promise<MIDIParsedData> {
  try {
    // Construct full URL if midiPath is a relative path
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
    const fullUrl = midiPath.startsWith('http') ? midiPath : `${API_URL}${midiPath}`

    // Fetch MIDI file
    const response = await fetch(fullUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch MIDI file: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const midi = new Midi(arrayBuffer)

    // Extract all notes from all tracks
    const allNotes: MIDINote[] = []

    midi.tracks.forEach(track => {
      track.notes.forEach(note => {
        allNotes.push({
          pitch: note.midi,
          pitchName: note.name,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
        })
      })
    })

    // Sort notes by time
    allNotes.sort((a, b) => a.time - b.time)

    return {
      notes: allNotes,
      duration: midi.duration,
      tempo: midi.header.tempos[0]?.bpm || 120,
      timeSignature: midi.header.timeSignatures[0]?.timeSignature || [4, 4],
    }
  } catch (error) {
    console.error('MIDI parsing error:', error)
    throw error
  }
}

/**
 * Get pitch range from notes
 */
export function getPitchRange(notes: MIDINote[]): { min: number; max: number } {
  if (notes.length === 0) {
    return { min: 60, max: 72 } // Default C4-C5
  }

  const pitches = notes.map(n => n.pitch)
  return {
    min: Math.min(...pitches),
    max: Math.max(...pitches),
  }
}

/**
 * Convert MIDI note number to frequency (Hz)
 */
export function midiToFrequency(midi: number): number {
  return Math.pow(2, (midi - 69) / 12) * 440
}

/**
 * Get note color based on pitch (for visualization)
 */
export function getNoteColor(pitch: number): string {
  const noteInOctave = pitch % 12
  const colors = [
    '#ef4444', // C - red
    '#f97316', // C# - orange
    '#f59e0b', // D - amber
    '#eab308', // D# - yellow
    '#84cc16', // E - lime
    '#22c55e', // F - green
    '#10b981', // F# - emerald
    '#14b8a6', // G - teal
    '#06b6d4', // G# - cyan
    '#0ea5e9', // A - sky
    '#3b82f6', // A# - blue
    '#6366f1', // B - indigo
  ]
  return colors[noteInOctave]
}

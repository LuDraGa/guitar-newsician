import { Renderer, Stave, StaveNote, Voice, Formatter, Beam } from 'vexflow'

export interface VexFlowConfig {
  width: number
  height: number
  clef: 'treble' | 'bass' | 'alto' | 'tenor'
}

export interface VexFlowNote {
  keys: string[]
  duration: string
}

/**
 * Initialize VexFlow renderer on a canvas element
 */
export function initializeVexFlowRenderer(
  canvasElement: HTMLCanvasElement,
  config: VexFlowConfig
) {
  const renderer = new Renderer(canvasElement, Renderer.Backends.CANVAS)
  renderer.resize(config.width, config.height)
  const context = renderer.getContext()

  // Set light color for dark theme (white notation on dark background)
  context.setFillStyle('#e0e0e0')
  context.setStrokeStyle('#e0e0e0')

  return { renderer, context }
}

/**
 * Convert music21 key signature format to VexFlow format
 * music21: "F# major", "A minor", "C major"
 * VexFlow: "F#", "Am", "C"
 */
function convertKeySignature(music21Key: string): string {
  const parts = music21Key.split(' ')

  if (parts.length < 2) {
    // Already in simple format or malformed
    return music21Key
  }

  const note = parts[0]  // e.g., "F#", "A", "C"
  const mode = parts[1].toLowerCase()  // e.g., "major", "minor"

  if (mode === 'minor') {
    return `${note}m`  // e.g., "Am"
  } else {
    return note  // e.g., "F#", "C"
  }
}

/**
 * Create a VexFlow stave (staff)
 */
export function createStave(
  context: any,
  x: number,
  y: number,
  width: number,
  clef?: string,
  keySignature?: string,
  timeSignature?: string
) {
  const stave = new Stave(x, y, width)

  // Only add clef if provided
  if (clef) {
    stave.addClef(clef)
  }

  if (keySignature) {
    // Convert music21 format to VexFlow format
    const vexflowKey = convertKeySignature(keySignature)
    stave.addKeySignature(vexflowKey)
  }

  if (timeSignature) {
    stave.addTimeSignature(timeSignature)
  }

  stave.setContext(context).draw()
  return stave
}

/**
 * Parse MusicXML and extract notes for VexFlow rendering
 */
export function parseMusicXMLToVexFlow(musicxml: string) {
  // TODO: Implement full MusicXML parsing
  // For Phase 1, we'll use a simplified parser
  // Later phases will need full MusicXML support

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(musicxml, 'text/xml')

  // Extract notes, chords, rests from MusicXML
  const measures = xmlDoc.getElementsByTagName('measure')
  const vexFlowMeasures: VexFlowNote[][] = []

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]
    const notes = measure.getElementsByTagName('note')
    const vexFlowNotes: VexFlowNote[] = []

    for (let j = 0; j < notes.length; j++) {
      const note = notes[j]
      const pitch = note.getElementsByTagName('pitch')[0]
      const duration = note.getElementsByTagName('duration')[0]
      const rest = note.getElementsByTagName('rest')[0]

      if (rest) {
        // Handle rest
        const durationValue = parseInt(duration?.textContent || '1')
        let vexFlowDuration = 'qr' // default quarter rest

        if (durationValue >= 960) vexFlowDuration = 'wr'      // whole rest
        else if (durationValue >= 480) vexFlowDuration = 'hr' // half rest
        else if (durationValue >= 240) vexFlowDuration = 'qr' // quarter rest
        else if (durationValue >= 120) vexFlowDuration = '8r' // eighth rest
        else vexFlowDuration = '16r'                           // sixteenth rest

        vexFlowNotes.push({
          keys: ['b/4'],  // Rest key (doesn't matter for display)
          duration: vexFlowDuration
        })
      } else if (pitch) {
        const step = pitch.getElementsByTagName('step')[0]?.textContent
        const octave = pitch.getElementsByTagName('octave')[0]?.textContent
        const alter = pitch.getElementsByTagName('alter')[0]?.textContent || '0'

        if (!step || !octave) continue

        // Convert to VexFlow notation (e.g., "c/4", "d#/5")
        const accidental = alter === '1' ? '#' : alter === '-1' ? 'b' : ''
        const vexFlowKey = `${step.toLowerCase()}${accidental}/${octave}`

        // Convert duration to VexFlow duration (e.g., "q" for quarter, "h" for half)
        const durationValue = parseInt(duration?.textContent || '1')
        let vexFlowDuration = 'q' // default quarter note

        // Simplified duration mapping (music21 divisions-based)
        // music21 typically uses 1024 divisions per quarter note
        if (durationValue >= 960) vexFlowDuration = 'w'      // whole note
        else if (durationValue >= 480) vexFlowDuration = 'h' // half note
        else if (durationValue >= 240) vexFlowDuration = 'q' // quarter note
        else if (durationValue >= 120) vexFlowDuration = '8' // eighth note
        else vexFlowDuration = '16'                           // sixteenth note

        vexFlowNotes.push({
          keys: [vexFlowKey],
          duration: vexFlowDuration
        })
      }
    }

    if (vexFlowNotes.length > 0) {
      vexFlowMeasures.push(vexFlowNotes)
    }
  }

  return vexFlowMeasures
}

/**
 * Render notes on a stave using VexFlow
 */
export function renderNotesOnStave(
  context: any,
  stave: any,
  notes: VexFlowNote[],
  timeSignature: string = '4/4'
) {
  if (notes.length === 0) return

  const vexFlowNotes = notes.map(note =>
    new StaveNote({
      keys: note.keys,
      duration: note.duration,
      clef: 'treble'
    })
  )

  // Parse time signature to get num_beats and beat_value
  const [num_beats, beat_value] = timeSignature.split('/').map(Number)

  // Create a voice and add notes
  // Use soft max to allow flexibility in note durations (Phase 1 workaround)
  const voice = new Voice({
    num_beats: num_beats || 4,
    beat_value: beat_value || 4
  })
  voice.setMode(Voice.Mode.SOFT) // Allow flexible timing
  voice.addTickables(vexFlowNotes)

  // Format and render
  const formatter = new Formatter()
  formatter.joinVoices([voice]).format([voice], stave.getWidth() - 20)
  voice.draw(context, stave)
}

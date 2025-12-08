/**
 * MIDI Editor Service
 * Handles API calls for MIDI transcription and AI-powered editing
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const API_BASE = `${API_URL}/api/v1/midi-editor`

export interface BasicPitchParams {
  onset_threshold: number
  frame_threshold: number
  minimum_note_length: number
  minimum_frequency?: number | null
  maximum_frequency?: number | null
  melodia_trick: boolean
  multiple_pitch_bends: boolean
}

export interface TranscribeRequest {
  song_id: string
  stem_name: string
  params?: BasicPitchParams
  force_retranscribe?: boolean
}

export interface TranscribeResponse {
  midi_path: string
  notes_detected: number
  params_used: BasicPitchParams
  message: string
}

export interface EditRequest {
  song_id: string
  stem_name: string
  section_start: number
  section_end: number
  issue_description: string
  instrument_idx?: number
}

// Typed parameter interfaces matching backend schemas
export interface MergeNotesParams {
  note_indices: number[]
  keep_first: boolean
}

export interface AddPitchBendParams {
  time: number
  semitones: number
}

export interface AddPitchBendSequenceParams {
  start_time: number
  end_time: number
  start_semitones: number
  end_semitones: number
  num_points: number
}

export interface ModifyNoteParams {
  note_idx: number
  pitch?: number
  start?: number
  end?: number
  velocity?: number
}

export interface AddNoteParams {
  pitch: number
  start: number
  end: number
  velocity: number
}

export interface DeleteNoteParams {
  note_idx: number
}

// Discriminated union type for all changes
export type ProposedChangeParams =
  | MergeNotesParams
  | AddPitchBendParams
  | AddPitchBendSequenceParams
  | ModifyNoteParams
  | AddNoteParams
  | DeleteNoteParams

export interface ProposedChange {
  type: 'merge_notes' | 'add_pitch_bend' | 'add_pitch_bend_sequence' | 'modify_note' | 'add_note' | 'delete_note'
  parameters?: ProposedChangeParams // Optional for backwards compatibility
  // Flattened parameters (for new structured output)
  note_indices?: number[]
  keep_first?: boolean
  time?: number
  semitones?: number
  start_time?: number
  end_time?: number
  start_semitones?: number
  end_semitones?: number
  num_points?: number
  note_idx?: number
  pitch?: number
  start?: number
  end?: number
  velocity?: number
  // Common fields
  description: string
  reasoning: string
}

export interface EditResponse {
  change_session_id: string
  proposed_changes: ProposedChange[]
  verification: {
    is_valid: boolean
    issues: string[]
    change_count: number
    summary: string
  }
  analysis_summary: string
  requires_approval: boolean
}

export interface ApprovalRequest {
  change_session_id: string
  approved: boolean
  feedback?: string
}

export interface ApprovalResponse {
  status: string
  applied_changes?: string[]
  message: string
}

export interface Preset {
  onset_threshold: number
  frame_threshold: number
  minimum_frequency?: number
  maximum_frequency?: number
  melodia_trick: boolean
  description: string
}

export interface PresetsResponse {
  presets: Record<string, Preset>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  song_id: string
  stem_name?: string
  query: string
  section_start?: number
  section_end?: number
  conversation_history?: ChatMessage[]
}

export interface ChatResponse {
  response: string
  structured_data?: {
    notes_count?: number
    chords_detected?: number
    chord_names?: string[]
  }
}

class MIDIEditorService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResponse> {
    return this.request<TranscribeResponse>('/transcribe', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async edit(request: EditRequest): Promise<EditResponse> {
    return this.request<EditResponse>('/edit', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async approve(request: ApprovalRequest): Promise<ApprovalResponse> {
    return this.request<ApprovalResponse>('/approve', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getPresets(): Promise<PresetsResponse> {
    return this.request<PresetsResponse>('/presets', {
      method: 'GET',
    })
  }

  async checkStatus(params: {
    song_id: string
    stem_name?: string
  }): Promise<{
    exists: boolean
    status: 'none' | 'transcribed' | 'error'
    midi_path?: string
    notes_detected?: number
    message: string
  }> {
    const queryParams = params.stem_name ? `?stem_name=${encodeURIComponent(params.stem_name)}` : ''
    return this.request<any>(`/status/${params.song_id}${queryParams}`, {
      method: 'GET',
    })
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
}

export const midiEditorService = new MIDIEditorService()

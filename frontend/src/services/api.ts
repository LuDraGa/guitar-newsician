/**
 * API service for communicating with the WereCode backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : 'http://localhost:8000/api/v1'

// ===== Types =====

export interface JobResponse {
  job_id: string
  status: string
  message: string
}

export interface ConvertRequest {
  input_path: string
  output_format?: string
  output_dir?: string
  sample_rate?: number
  channels?: number
}

export interface AnalysisRequest {
  input_path: string
  analyzers?: string[]
  preset?: string
  config_path?: string
  transpose_to?: string
}

export interface StemSeparationRequest {
  input_path: string
  model?: string
  stems?: number
  output_dir?: string
  shifts?: number
}

export interface LyricsFetchRequest {
  song_id: string
}

export interface LyricsResponse {
  synced: string | null
  plain: string | null
}

export interface AnalysisData {
  tempo?: {
    bpm: number
    confidence: number
    beats: number[]
    downbeats: number[]
  }
  key?: {
    key: string
    scale: string
    strength: number
  }
  chords?: Array<{
    timestamp: number
    chord: string
    duration: number
  }>
  sections?: Array<{
    label: string
    start: number
    end: number
  }>
}

// ===== API Functions =====

/**
 * Library endpoints
 */
export const libraryApi = {
  async scanLibrary() {
    const response = await fetch(`${API_BASE_URL}/library/scan`)
    if (!response.ok) throw new Error('Failed to scan library')
    return response.json()
  },

  async getSong(songId: string) {
    const response = await fetch(`${API_BASE_URL}/library/songs/${songId}`)
    if (!response.ok) throw new Error(`Failed to get song: ${songId}`)
    return response.json()
  },

  async getLyrics(songId: string): Promise<LyricsResponse> {
    const response = await fetch(`${API_BASE_URL}/library/songs/${songId}/lyrics`)
    if (!response.ok) {
      // Return empty if not found
      if (response.status === 404) {
        return { synced: null, plain: null }
      }
      throw new Error(`Failed to get lyrics: ${songId}`)
    }
    return response.json()
  },

  async getAnalysis(songId: string): Promise<AnalysisData> {
    const response = await fetch(`${API_BASE_URL}/library/songs/${songId}/analysis`)
    if (!response.ok) throw new Error(`Failed to get analysis: ${songId}`)
    return response.json()
  },

  async getAudioUrl(songId: string): Promise<string> {
    return `${API_BASE_URL}/library/songs/${songId}/audio`
  },

  async getStemUrl(songId: string, stemType: string): Promise<string> {
    return `${API_BASE_URL}/library/songs/${songId}/stems/${stemType}`
  },

  async deleteSong(songId: string) {
    const response = await fetch(`${API_BASE_URL}/library/songs/${songId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error(`Failed to delete song: ${songId}`)
    return response.json()
  },
}

/**
 * Convert endpoints
 */
export const convertApi = {
  async convert(request: ConvertRequest): Promise<JobResponse> {
    const response = await fetch(`${API_BASE_URL}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('Failed to start conversion')
    return response.json()
  },
}

/**
 * Analysis endpoints
 */
export const analysisApi = {
  async analyze(request: AnalysisRequest): Promise<JobResponse> {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('Failed to start analysis')
    return response.json()
  },

  async queryAnalysis(songId?: string, analysisTypes?: string[]) {
    const params = new URLSearchParams()
    if (songId) params.append('song_id', songId)
    if (analysisTypes) params.append('analysis_types', analysisTypes.join(','))

    const response = await fetch(`${API_BASE_URL}/analyze/query?${params}`)
    if (!response.ok) throw new Error('Failed to query analysis')
    return response.json()
  },
}

/**
 * Stem separation endpoints
 */
export const stemsApi = {
  async separate(request: StemSeparationRequest): Promise<JobResponse> {
    const response = await fetch(`${API_BASE_URL}/stems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('Failed to start stem separation')
    return response.json()
  },
}

/**
 * Lyrics endpoints
 */
export const lyricsApi = {
  async fetch(request: LyricsFetchRequest) {
    const response = await fetch(`${API_BASE_URL}/lyrics/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('Failed to fetch lyrics')
    return response.json()
  },
}

/**
 * Job tracking endpoints
 */
export const jobsApi = {
  async getJob(jobId: string) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`)
    if (!response.ok) throw new Error(`Failed to get job: ${jobId}`)
    return response.json()
  },

  async listJobs(limit?: number) {
    const params = limit ? `?limit=${limit}` : ''
    const response = await fetch(`${API_BASE_URL}/jobs${params}`)
    if (!response.ok) throw new Error('Failed to list jobs')
    return response.json()
  },
}

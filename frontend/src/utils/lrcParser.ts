/**
 * LRC (Lyric) file parser
 *
 * Parses synchronized lyrics in LRC format:
 * [00:12.00]Line of lyrics
 * [00:17.20]Another line
 */

import { LyricLine } from '@/components/studio/types'

/**
 * Parse LRC format timestamp to seconds
 * Format: [mm:ss.xx] where xx is centiseconds
 */
function parseTimestamp(timestamp: string): number {
  const match = timestamp.match(/\[(\d+):(\d+)\.(\d+)\]/)
  if (!match) return 0

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  const centiseconds = parseInt(match[3], 10)

  return minutes * 60 + seconds + centiseconds / 100
}

/**
 * Parse LRC format lyrics into array of lyric lines
 */
export function parseLRC(lrcContent: string): LyricLine[] {
  if (!lrcContent) return []

  const lines = lrcContent.split('\n')
  const lyricLines: LyricLine[] = []

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Skip metadata tags (e.g., [ar:Artist], [ti:Title], etc.)
    if (line.match(/^\[(ar|ti|al|au|length|by|offset|re|ve):/i)) continue

    // Match lyric lines with timestamp
    const match = line.match(/^(\[\d+:\d+\.\d+\])(.*)$/)
    if (match) {
      const timestamp = parseTimestamp(match[1])
      const text = match[2].trim()

      // Only add if there's actual text (skip instrumental markers)
      if (text || text === '') {
        lyricLines.push({ timestamp, text })
      }
    }
  }

  // Sort by timestamp (should already be sorted, but just in case)
  lyricLines.sort((a, b) => a.timestamp - b.timestamp)

  return lyricLines
}

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Format seconds to MM:SS.xx (with centiseconds)
 */
export function formatTimeDetailed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const centisecs = Math.floor((seconds % 1) * 100)
  return `${mins}:${String(secs).padStart(2, '0')}.${String(centisecs).padStart(2, '0')}`
}

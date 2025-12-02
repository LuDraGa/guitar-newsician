import { cn } from '@/utils'

interface AnalysisOverlaysProps {
  analysisData: any
  duration: number
  overlays: Set<string>
  height: number
  className?: string
}

export function AnalysisOverlays({ analysisData, duration, overlays, height, className }: AnalysisOverlaysProps) {
  if (!analysisData || duration <= 0) return null

  // Helper function to convert time to percentage
  const timeToPercent = (time: number) => (time / duration) * 100

  // Extract data from nested structure
  // Backend returns: { tempo_beats: { data: { beats_sec: [...], downbeats_sec: [...] } } }
  const beatsData = analysisData.tempo_beats?.data || analysisData.tempo_beats
  const chordsData = analysisData.chords?.data || analysisData.chords
  const sectionsData = analysisData.structure_msaf?.data || analysisData.structure_msaf

  const beats = beatsData?.beats_sec || beatsData?.beats || []
  const downbeats = beatsData?.downbeats_sec || beatsData?.downbeats || []
  const chords = chordsData?.progression || []
  const sections = sectionsData?.mapped_segments || sectionsData?.segments || []

  console.log('[AnalysisOverlays] Data:', { beats: beats.length, downbeats: downbeats.length, chords: chords.length, sections: sections.length })

  return (
    <svg className={cn('pointer-events-none absolute inset-0', className)} width="100%" height={height}>
      {/* Beat overlays */}
      {overlays.has('beats') && beats.length > 0 && (
        <g>
          {beats.map((beat: number, i: number) => {
            const x = `${timeToPercent(beat)}%`
            const isDownbeat = downbeats.includes(beat)

            return (
              <line
                key={`beat-${i}`}
                x1={x}
                y1="0"
                x2={x}
                y2={height}
                stroke={isDownbeat ? '#3b82f6' : '#60a5fa'}
                strokeWidth={isDownbeat ? 2 : 1}
                strokeOpacity={isDownbeat ? 0.6 : 0.3}
              />
            )
          })}
        </g>
      )}

      {/* Chord overlays */}
      {overlays.has('chords') && chords.length > 0 && (
        <g>
          {chords.map((chord: any, i: number) => {
            const x = timeToPercent(chord.start_sec)
            const width = timeToPercent(chord.end_sec - chord.start_sec)

            // Color based on chord quality
            const isMinor = chord.chord?.toLowerCase().includes('min') || chord.chord?.includes(':min')
            const color = isMinor ? '#a78bfa' : '#c084fc'

            return (
              <g key={`chord-${i}`}>
                <rect
                  x={`${x}%`}
                  y="0"
                  width={`${width}%`}
                  height={height}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
                <text
                  x={`${x + width / 2}%`}
                  y={20}
                  fill={color}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  opacity={0.8}
                >
                  {chord.chord}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* Section overlays */}
      {overlays.has('sections') && sections.length > 0 && (
        <g>
          {sections.map((section: any, i: number) => {
            const x = timeToPercent(section.start_sec)
            const width = timeToPercent(section.end_sec - section.start_sec)

            // Color based on section type
            const sectionColors: Record<string, string> = {
              intro: '#fbbf24',
              verse: '#60a5fa',
              chorus: '#f472b6',
              bridge: '#a78bfa',
              outro: '#fb923c',
              section: '#94a3b8',
            }

            const sectionLabel = section.section || section.label || 'section'
            const color = sectionColors[sectionLabel.toLowerCase()] || '#94a3b8'

            return (
              <g key={`section-${i}`}>
                <rect
                  x={`${x}%`}
                  y={height - 30}
                  width={`${width}%`}
                  height={25}
                  fill={color}
                  fillOpacity={0.2}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  rx={4}
                />
                <text
                  x={`${x + width / 2}%`}
                  y={height - 12}
                  fill={color}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  opacity={0.9}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {sectionLabel}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}

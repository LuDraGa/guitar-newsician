# Maestro fact-pack current analysis rows

## Context

`/app/maestro` Fast pack failed for `BabySlakh Track00002`
(`61e384ca-cca1-427f-9161-e6e3402ace75`) with:

```text
Missing mix analysis for song 61e384ca-cca1-427f-9161-e6e3402ace75. Seed or analyze it first.
```

The failing song had current full-mix analysis from the normal pipeline, but the
local Maestro adapter only looked for the older seed-only
`analysis_results.analyzer_name = maestro_mix_analysis` envelope.

## Fix

- Prefer current analyzer rows attached to the current `analysis_json` asset.
- Synthesize the legacy `{ response: { analyses } }` envelope expected by the
  existing fact-pack builder.
- Keep `maestro_mix_analysis` as a fallback for old seeded songs.
- Filter per-stem analysis rows by `stem_analysis_json` asset and `metadata.stem_id`
  so they enrich stem summaries without polluting the song-level mix analysis.
- Filter adapter asset reads to `is_current = true` so stale analysis assets do
  not affect manifests or fact-pack source hashes.

## Verification

```bash
cd maestro
uv run pytest
```

Result: `4 passed`.

Live smoke, non-persisting `_build_pack` for Track00002:

```text
analysis_keys: _meta, basic_stats, tempo_beats, tonal_key, chords, structure_msaf
tempo_bpm: 82.67395782470703
key: Bb minor
sections: 12
stems: 10
stem_analysis_ready: 2
```

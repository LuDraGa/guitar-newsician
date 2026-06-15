-- WereCode: per-stem analysis + per-stem MIDI asset kinds (Maestro role axis).
--
-- Run once against the existing Supabase project after
-- `2026-06-06_werecode_pipeline_versions.sql`.
--
-- Why: Maestro's comprehension graph has a first-class instrument-role axis
-- (`time-level × role`). Per-stem *audio* is already first-class
-- (`stem_vocals/drums/bass/other/guitar/piano` + `stems_manifest`), but
-- `analysis_json` is full-mix and `midi`/`note_events` are full-track — so the
-- role axis has no per-stem substrate. This widens `werecode.assets.kind` with
-- per-stem MIDI and per-stem analysis kinds (build-flow §1, option a).
--
-- Scope: this migration only widens the `kind` enum. Per-stem `analyze` /
-- `midi_transcribe` runs reuse the existing `jobs.job_type` values and target a
-- stem by carrying the stem asset id in `jobs.request_payload` — no jobs DDL
-- needed. Per-stem analysis may also be stored as structured rows in
-- `werecode.analysis_results` whose nullable `asset_id` points at the stem asset;
-- that FK already exists. RLS on `werecode.assets` keys on `owner_id` / bucket,
-- not on `kind`, so the new kinds need no policy changes.

begin;

-- The base schema declared `kind` with an inline single-column CHECK, which
-- Postgres auto-names `assets_kind_check`. Drop it before re-adding the widened
-- list. (Note: Postgres stores `kind in (...)` normalized as `kind = ANY
-- (ARRAY[...])`, so do not try to locate this constraint by matching its textual
-- definition for `in (` — drop it by its known name.) Idempotent: re-running
-- re-drops the widened constraint and re-adds it.
alter table werecode.assets
  drop constraint if exists assets_kind_check;

alter table werecode.assets
  add constraint assets_kind_check check (
    kind in (
      -- sources
      'source_audio',
      'source_video',
      'source_metadata',
      'source_midi',
      'source_musicxml',
      -- derived audio
      'normalized_audio',
      'preview_audio',
      -- per-stem audio
      'stem_vocals',
      'stem_drums',
      'stem_bass',
      'stem_other',
      'stem_guitar',
      'stem_piano',
      'stems_manifest',
      -- per-stem MIDI (new: Maestro role axis)
      'stem_midi_vocals',
      'stem_midi_drums',
      'stem_midi_bass',
      'stem_midi_other',
      'stem_midi_guitar',
      'stem_midi_piano',
      -- analysis
      'analysis_json',
      -- per-stem analysis (new: Maestro role axis)
      'stem_analysis_json',
      -- lyrics
      'lyrics_plain',
      'lyrics_lrc',
      'lyrics_alignment',
      -- midi / notation
      'midi',
      'note_events',
      'musicxml',
      'tab_musicxml',
      -- misc
      'waveform_json',
      'spectrogram_image',
      'midi_edit_manifest'
    )
  );

commit;

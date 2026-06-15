/**
 * Maestro dev-seed (Prep A0): write ONE trusted, per-stem BabySlakh track into
 * the WereCode `werecode` schema + storage buckets, so the baseline agent
 * (Phase C) has real per-(song, stem) data to comprehend before the polished
 * trusted-upload UI (Prep A2) exists.
 *
 * This is the stand-in for the not-yet-built stem-upload UI. It writes to your
 * real Supabase via the service-role key (bypasses RLS), exactly mirroring the
 * app's asset conventions:
 *   - owner-prefixed object paths:  <owner>/<songId>/<area>/<file>
 *   - trusted uploaded sources  ->  bucket `werecode-sources`
 *   - machine-derived artifacts ->  bucket `werecode-artifacts`
 *   - provenance recorded in `assets.metadata`
 *
 * Asset-kind convention (Phase C reads these back):
 *   mix.wav              -> source_audio        (werecode-sources)
 *   all_src.mid          -> source_midi         (werecode-sources)
 *   stems/Sxx.wav        -> stem_<role>         (werecode-sources)   role from inst_class
 *   MIDI/Sxx.mid         -> stem_midi_<role>    (werecode-sources)   source_asset_id -> stem audio
 *   mix.analysis JSON    -> analysis_json       (werecode-artifacts) + an analysis_results row
 *   (per-stem analysis   -> stem_analysis_json: none in BabySlakh; skipped)
 *
 * Run (Node 22; loads Supabase env from .env):
 *   node --env-file=.env scripts/seed-maestro-babyslakh.mjs
 * Options:
 *   --track <dir>     BabySlakh track directory (default: the POC Track00001)
 *   --owner <uuid>    owner_id (default: $WERECODE_DEV_USER_ID)
 *   --force           seed again even if a seed song already exists
 *
 * Reversible: `delete from werecode.songs where id='<id>'` cascades assets +
 * analysis_results; storage objects under <owner>/<songId>/ can then be removed.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const SCHEMA = 'werecode';
const BUCKET_SOURCES = 'werecode-sources';
const BUCKET_ARTIFACTS = 'werecode-artifacts';
const SEED_MARKER_BASE = 'babyslakh';
const DEFAULT_TRACK_DIR =
  '/Users/abhiroopprasad/code/personal/modal_apis/Maestro/babyslakh_16k/Track00001';

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const trackDir = arg('track', DEFAULT_TRACK_DIR);
const owner = arg('owner', process.env.WERECODE_DEV_USER_ID);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const missing = [];
if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!owner) missing.push('WERECODE_DEV_USER_ID (or pass --owner <uuid>)');
if (missing.length) die(`Missing required env: ${missing.join(', ')}`);
if (!existsSync(trackDir)) die(`Track directory not found: ${trackDir}`);

const trackId = basename(trackDir);
const seedSource = `${SEED_MARKER_BASE}:${trackId}`;

const supabase = createClient(url, serviceKey, {
  db: { schema: SCHEMA },
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- BabySlakh readers -----------------------------------------------------

/** Minimal parse of metadata.yaml's `stems:` block (no YAML dep). */
function parseStems(yamlText) {
  const stems = [];
  let inStems = false;
  let cur = null;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^stems:\s*$/.test(line)) {
      inStems = true;
      continue;
    }
    if (!inStems) continue;
    if (/^\S/.test(line)) break; // next top-level key ends the block
    const header = line.match(/^\s+(S\d+):\s*$/);
    if (header) {
      if (cur) stems.push(cur);
      cur = { stem_id: header[1], inst_class: null, is_drum: false };
      continue;
    }
    if (!cur) continue;
    const ic = line.match(/^\s+inst_class:\s*(.+?)\s*$/);
    if (ic) cur.inst_class = ic[1].replace(/^["']|["']$/g, '');
    const dr = line.match(/^\s+is_drum:\s*(true|false)\s*$/i);
    if (dr) cur.is_drum = dr[1].toLowerCase() === 'true';
  }
  if (cur) stems.push(cur);
  return stems;
}

function roleFromInstClass(instClass, isDrum) {
  const s = (instClass || '').toLowerCase();
  if (isDrum || s.includes('drum')) return 'drums';
  if (s.includes('bass')) return 'bass';
  if (s.includes('guitar')) return 'guitar';
  if (s.includes('piano')) return 'piano';
  if (s.includes('voc') || s.includes('voice')) return 'vocals';
  return 'other';
}

// ---- WereCode writers ------------------------------------------------------

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function uploadAsset({ kind, bucket, area, localPath, songId, versionId, sourceAssetId, metadata }) {
  const bytes = readFileSync(localPath);
  const file = basename(localPath);
  const objectPath = [owner, songId, area, file].join('/');
  const contentType = file.endsWith('.wav')
    ? 'audio/wav'
    : file.endsWith('.mid')
      ? 'audio/midi'
      : file.endsWith('.json')
        ? 'application/json'
        : 'application/octet-stream';

  const up = await supabase.storage.from(bucket).upload(objectPath, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(`upload ${objectPath}: ${up.error.message}`);

  const { data, error } = await supabase
    .from('assets')
    .insert({
      owner_id: owner,
      song_id: songId,
      version_id: versionId,
      kind,
      bucket_id: bucket,
      object_path: objectPath,
      content_type: contentType,
      byte_size: bytes.byteLength,
      checksum_sha256: sha256(bytes),
      source_asset_id: sourceAssetId ?? null,
      metadata: { seed_source: seedSource, ...(metadata ?? {}) },
    })
    .select('id, kind')
    .single();
  if (error) throw new Error(`insert asset ${kind}: ${error.message}`);
  console.log(`  + ${kind.padEnd(18)} ${bucket}/${objectPath}`);
  return data.id;
}

async function main() {
  console.log(`\nSeeding ${trackId} -> werecode (owner ${owner})\n`);

  // Idempotency guard.
  const existing = await supabase
    .from('songs')
    .select('id')
    .eq('owner_id', owner)
    .eq('metadata->>seed_source', seedSource)
    .maybeSingle();
  if (existing.error) die(`lookup existing seed song: ${existing.error.message}`);
  if (existing.data && !hasFlag('force')) {
    console.log(`Already seeded as song ${existing.data.id}. Use --force to seed another copy.\n`);
    return;
  }

  // Read BabySlakh inputs.
  const metaPath = join(trackDir, 'metadata.yaml');
  const stems = existsSync(metaPath) ? parseStems(readFileSync(metaPath, 'utf8')) : [];
  const analysisPath = join(trackDir, 'maestro_analysis', 'mix.analysis.latest.json');
  if (!existsSync(analysisPath)) die(`Missing mix analysis: ${analysisPath} (run analysis in the POC first)`);
  const mixAnalysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  const durationSec = mixAnalysis?.response?.analyses?._meta?.duration_sec ?? null;

  // 1) Song + source version.
  const songInsert = await supabase
    .from('songs')
    .insert({
      owner_id: owner,
      title: `BabySlakh ${trackId}`,
      artist: 'Slakh2100 (synthetic)',
      source_kind: 'audio_upload',
      status: 'ready',
      duration_sec: durationSec,
      has_audio: true,
      has_normalized_audio: true,
      has_stems: true,
      has_midi: true,
      has_analysis: true,
      metadata: { seed_source: seedSource, track_id: trackId },
    })
    .select('id')
    .single();
  if (songInsert.error) die(`create song: ${songInsert.error.message}`);
  const songId = songInsert.data.id;
  console.log(`song ${songId}`);

  const versionInsert = await supabase
    .from('song_versions')
    .insert({
      song_id: songId,
      owner_id: owner,
      label: 'BabySlakh seed',
      version_kind: 'source',
      status: 'ready',
      metadata: { seed_source: seedSource },
    })
    .select('id')
    .single();
  if (versionInsert.error) die(`create song_version: ${versionInsert.error.message}`);
  const versionId = versionInsert.data.id;

  // 2) Trusted sources -> werecode-sources.
  const mixWav = join(trackDir, 'mix.wav');
  if (existsSync(mixWav)) {
    await uploadAsset({
      kind: 'source_audio',
      bucket: BUCKET_SOURCES,
      area: 'sources',
      localPath: mixWav,
      songId,
      versionId,
      metadata: { provenance: 'uploaded', role: 'mix' },
    });
  }
  const allSrcMidi = join(trackDir, 'all_src.mid');
  if (existsSync(allSrcMidi)) {
    await uploadAsset({
      kind: 'source_midi',
      bucket: BUCKET_SOURCES,
      area: 'sources',
      localPath: allSrcMidi,
      songId,
      versionId,
      metadata: { provenance: 'uploaded', role: 'all_src' },
    });
  }

  // 3) Per-stem audio + MIDI -> werecode-sources, keyed by role + stem_id.
  const stemsDir = join(trackDir, 'stems');
  const midiDir = join(trackDir, 'MIDI');
  const stemList = stems.length
    ? stems
    : (existsSync(stemsDir) ? readdirSync(stemsDir) : [])
        .filter((f) => f.endsWith('.wav'))
        .map((f) => ({ stem_id: basename(f, '.wav'), inst_class: null, is_drum: false }));

  for (const stem of stemList) {
    const role = roleFromInstClass(stem.inst_class, stem.is_drum);
    const stemMeta = {
      provenance: 'uploaded',
      stem_id: stem.stem_id,
      inst_class: stem.inst_class,
      is_drum: stem.is_drum,
      role,
    };
    const wav = join(stemsDir, `${stem.stem_id}.wav`);
    let stemAudioId = null;
    if (existsSync(wav)) {
      stemAudioId = await uploadAsset({
        kind: `stem_${role}`,
        bucket: BUCKET_SOURCES,
        area: 'sources/stems',
        localPath: wav,
        songId,
        versionId,
        metadata: stemMeta,
      });
    }
    const mid = join(midiDir, `${stem.stem_id}.mid`);
    if (existsSync(mid)) {
      await uploadAsset({
        kind: `stem_midi_${role}`,
        bucket: BUCKET_SOURCES,
        area: 'sources/stem-midi',
        localPath: mid,
        songId,
        versionId,
        sourceAssetId: stemAudioId,
        metadata: stemMeta,
      });
    }
  }

  // 4) Mix analysis -> werecode-artifacts (blob) + analysis_results (structured).
  const analysisAssetId = await uploadAsset({
    kind: 'analysis_json',
    bucket: BUCKET_ARTIFACTS,
    area: 'artifacts',
    localPath: analysisPath,
    songId,
    versionId,
    metadata: { provenance: 'derived', analyzer: 'maestro/modal', scope: 'mix' },
  });
  const ar = await supabase
    .from('analysis_results')
    .insert({
      song_id: songId,
      owner_id: owner,
      asset_id: analysisAssetId,
      analyzer_name: 'maestro_mix_analysis',
      analyzer_version: mixAnalysis?.response?.call_id ? 'poc' : null,
      ok: true,
      data: mixAnalysis,
    })
    .select('id')
    .single();
  if (ar.error) die(`insert analysis_results: ${ar.error.message}`);
  console.log(`  + analysis_results   ${ar.data.id}`);

  console.log(`\n✓ Seeded song ${songId} (${stemList.length} stems).`);
  console.log(`  Remove with: delete from werecode.songs where id='${songId}';`);
  console.log(`  (then clear storage under ${owner}/${songId}/ in the 2 buckets)\n`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));

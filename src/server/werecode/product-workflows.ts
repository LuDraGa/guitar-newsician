import 'server-only';

import { z } from 'zod';

import { WERECODE_STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';
import type { AssetKind, AssetRow, JobRow, Json, MidiEditSessionRow, SongRow } from '@/types/werecode';

type SupabaseClient = Awaited<ReturnType<typeof getWereCodeRequestContext>>['supabase'];

export const createMidiEditSessionSchema = z.object({
  source_midi_asset_id: z.string().uuid().nullable().optional(),
  stem_name: z.string().trim().min(1).nullable().optional(),
  section_start_sec: z.number().nonnegative().nullable().optional(),
  section_end_sec: z.number().nonnegative().nullable().optional(),
  issue_description: z.string().trim().min(1).nullable().optional(),
  proposed_changes: z.array(z.record(z.string(), z.unknown())).default([]),
  verification: z.record(z.string(), z.unknown()).default({}),
  feedback: z.string().trim().min(1).nullable().optional(),
});

export const updateMidiEditSessionSchema = createMidiEditSessionSchema
  .partial()
  .extend({
    output_midi_asset_id: z.string().uuid().nullable().optional(),
    status: z.enum(['proposed', 'approved', 'rejected', 'applied', 'failed']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one edit session field' });

export const musicXmlWorkflowSchema = z.object({
  song_id: z.string().uuid(),
  note_events_asset_id: z.string().uuid(),
  title: z.string().trim().min(1).optional(),
  divisions: z.number().int().min(1).max(960).default(480),
});

export const midiEditApplySchema = z.object({
  song_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  source_midi_asset_id: z.string().uuid().nullable().optional(),
  proposed_changes: z.array(z.record(z.string(), z.unknown())).min(1),
  verification: z.record(z.string(), z.unknown()).default({}),
});

export const arrangementManifestSchema = z.object({
  song_id: z.string().uuid(),
  name: z.string().trim().min(1).default('Arrangement'),
  sections: z.array(z.record(z.string(), z.unknown())).default([]),
  tracks: z.array(z.record(z.string(), z.unknown())).default([]),
  asset_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().optional(),
});

export async function listMidiEditSessions(songId: string) {
  const { user, supabase } = await getWereCodeRequestContext();
  const { data, error } = await supabase
    .from('midi_edit_sessions')
    .select('*')
    .eq('song_id', songId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MidiEditSessionRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createMidiEditSession(songId: string, input: z.infer<typeof createMidiEditSessionSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = createMidiEditSessionSchema.parse(input);
  await assertOwnedSong(supabase, user.id, songId);
  const { data, error } = await supabase
    .from('midi_edit_sessions')
    .insert({
      ...body,
      owner_id: user.id,
      song_id: songId,
      status: 'proposed',
    })
    .select('*')
    .single<MidiEditSessionRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateMidiEditSession(songId: string, sessionId: string, input: z.infer<typeof updateMidiEditSessionSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = updateMidiEditSessionSchema.parse(input);
  const { data, error } = await supabase
    .from('midi_edit_sessions')
    .update(body)
    .eq('id', sessionId)
    .eq('song_id', songId)
    .eq('owner_id', user.id)
    .select('*')
    .single<MidiEditSessionRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function convertNoteEventsToMusicXml(input: z.infer<typeof musicXmlWorkflowSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = musicXmlWorkflowSchema.parse(input);
  const sourceAsset = await getOwnedAsset(supabase, user.id, body.song_id, body.note_events_asset_id);
  const job = await createJob(supabase, user.id, body.song_id, 'midi_to_musicxml', {
    workflow: 'midi_to_musicxml',
    ...body,
  });

  try {
    const noteEvents = await readJsonAsset(supabase, sourceAsset);
    const musicXml = buildMusicXml({
      title: body.title ?? 'WereCode transcription',
      divisions: body.divisions,
      notes: extractNoteEvents(noteEvents),
    });
    const asset = await uploadTextAsset(supabase, {
      ownerId: user.id,
      songId: body.song_id,
      jobId: job.id,
      kind: 'musicxml',
      filename: 'score.musicxml',
      contentType: 'application/vnd.recordare.musicxml+xml',
      content: musicXml,
      metadata: {
        source_asset_id: sourceAsset.id,
      },
    });
    const updatedJob = await updateJob(supabase, user.id, job.id, {
      status: 'ready',
      progress: 100,
      message: 'MusicXML generated from note events',
      response_payload: {
        asset_id: asset.id,
      },
      completed_at: new Date().toISOString(),
    });

    return { job: updatedJob, assets: [asset] };
  } catch (error) {
    await failJob(supabase, user.id, job.id, error);
    throw error;
  }
}

export async function applyMidiEditManifest(input: z.infer<typeof midiEditApplySchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = midiEditApplySchema.parse(input);
  const job = await createJob(supabase, user.id, body.song_id, 'midi_edit_apply', {
    workflow: 'midi_edit_apply',
    ...body,
  });

  try {
    const session = body.session_id
      ? await updateMidiEditSession(body.song_id, body.session_id, {
          status: 'applied',
          proposed_changes: body.proposed_changes,
          verification: body.verification,
        })
      : await createMidiEditSession(body.song_id, {
          source_midi_asset_id: body.source_midi_asset_id,
          proposed_changes: body.proposed_changes,
          verification: body.verification,
        });

    const asset = await uploadJsonAsset(supabase, {
      ownerId: user.id,
      songId: body.song_id,
      jobId: job.id,
      kind: 'midi_edit_manifest',
      filename: 'midi-edit-manifest.json',
      payload: {
        session_id: session.id,
        source_midi_asset_id: body.source_midi_asset_id ?? session.source_midi_asset_id,
        proposed_changes: body.proposed_changes,
        verification: body.verification,
        applied_at: new Date().toISOString(),
      },
    });
    const updatedSession = await updateMidiEditSession(body.song_id, session.id, {
      status: 'applied',
      output_midi_asset_id: asset.id,
    });
    const updatedJob = await updateJob(supabase, user.id, job.id, {
      status: 'ready',
      progress: 100,
      message: 'MIDI edit manifest applied',
      response_payload: {
        session_id: updatedSession.id,
        manifest_asset_id: asset.id,
      },
      completed_at: new Date().toISOString(),
    });

    return { job: updatedJob, session: updatedSession, assets: [asset] };
  } catch (error) {
    await failJob(supabase, user.id, job.id, error);
    throw error;
  }
}

export async function saveArrangementManifest(input: z.infer<typeof arrangementManifestSchema>) {
  const { user, supabase } = await getWereCodeRequestContext();
  const body = arrangementManifestSchema.parse(input);
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('*')
    .eq('id', body.song_id)
    .eq('owner_id', user.id)
    .single<SongRow>();

  if (songError) {
    throw songError;
  }

  const manifest = {
    name: body.name,
    sections: body.sections,
    tracks: body.tracks,
    asset_ids: body.asset_ids,
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('songs')
    .update({
      metadata: {
        ...jsonObject(song.metadata),
        arrangement_manifest: manifest,
      },
    })
    .eq('id', body.song_id)
    .eq('owner_id', user.id)
    .select('*')
    .single<SongRow>();

  if (error) {
    throw error;
  }

  return { song: data, manifest };
}

async function getOwnedAsset(supabase: SupabaseClient, ownerId: string, songId: string, assetId: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .eq('song_id', songId)
    .eq('owner_id', ownerId)
    .single<AssetRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function assertOwnedSong(supabase: SupabaseClient, ownerId: string, songId: string) {
  const { error } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('owner_id', ownerId)
    .single();

  if (error) {
    throw error;
  }
}

async function readJsonAsset(supabase: SupabaseClient, asset: AssetRow) {
  const { data, error } = await supabase.storage.from(asset.bucket_id).download(asset.object_path);
  if (error) {
    throw error;
  }

  return JSON.parse(await data.text()) as unknown;
}

async function createJob(
  supabase: SupabaseClient,
  ownerId: string,
  songId: string,
  jobType: string,
  requestPayload: Record<string, unknown>
) {
  await assertOwnedSong(supabase, ownerId, songId);
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: ownerId,
      song_id: songId,
      job_type: jobType,
      status: 'processing',
      progress: 10,
      request_payload: requestPayload,
    })
    .select('*')
    .single<JobRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function updateJob(supabase: SupabaseClient, ownerId: string, jobId: string, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('jobs')
    .update(values)
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .select('*')
    .single<JobRow>();
  if (error) {
    throw error;
  }

  return data;
}

async function failJob(supabase: SupabaseClient, ownerId: string, jobId: string, error: unknown) {
  await updateJob(supabase, ownerId, jobId, {
    status: 'failed',
    progress: 0,
    message: 'Next product workflow failed',
    error_message: error instanceof Error ? error.message : 'Unknown workflow failure',
    completed_at: new Date().toISOString(),
  });
}

async function uploadJsonAsset(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId: string;
    jobId: string;
    kind: AssetKind;
    filename: string;
    payload: Record<string, unknown>;
  }
) {
  return uploadTextAsset(supabase, {
    ...options,
    contentType: 'application/json',
    content: JSON.stringify(options.payload, null, 2),
  });
}

async function uploadTextAsset(
  supabase: SupabaseClient,
  options: {
    ownerId: string;
    songId: string;
    jobId: string;
    kind: AssetKind;
    filename: string;
    contentType: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
) {
  const objectPath = [options.ownerId, options.songId, 'artifacts', options.jobId, options.filename].join('/');
  const bytes = Buffer.from(options.content);
  const { error: uploadError } = await supabase.storage.from(WERECODE_STORAGE_BUCKETS.artifacts).upload(objectPath, bytes, {
    contentType: options.contentType,
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      owner_id: options.ownerId,
      song_id: options.songId,
      kind: options.kind,
      bucket_id: WERECODE_STORAGE_BUCKETS.artifacts,
      object_path: objectPath,
      content_type: options.contentType,
      byte_size: bytes.byteLength,
      metadata: {
        job_id: options.jobId,
        ...(options.metadata ?? {}),
      },
    })
    .select('*')
    .single<AssetRow>();

  if (error) {
    throw error;
  }

  return data;
}

function extractNoteEvents(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && Array.isArray((value as { note_events?: unknown }).note_events)) {
    return (value as { note_events: unknown[] }).note_events;
  }
  if (value && typeof value === 'object' && Array.isArray((value as { notes?: unknown }).notes)) {
    return (value as { notes: unknown[] }).notes;
  }

  return [];
}

function buildMusicXml(options: { title: string; divisions: number; notes: unknown[] }) {
  const notes = options.notes.map((note) => musicXmlNote(note, options.divisions)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>${escapeXml(options.title)}</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>${options.divisions}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
${notes || restNote(options.divisions)}
    </measure>
  </part>
</score-partwise>
`;
}

function musicXmlNote(value: unknown, divisions: number) {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const midi = typeof record.pitch_midi === 'number' ? record.pitch_midi : typeof record.midi === 'number' ? record.midi : 60;
  const onset = typeof record.onset_sec === 'number' ? record.onset_sec : 0;
  const offset = typeof record.offset_sec === 'number' ? record.offset_sec : onset + 0.5;
  const duration = Math.max(1, Math.round((offset - onset) * divisions));
  const pitch = midiToPitch(midi);

  return `      <note>
        <pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ''}<octave>${pitch.octave}</octave></pitch>
        <duration>${duration}</duration>
        <type>quarter</type>
      </note>`;
}

function restNote(divisions: number) {
  return `      <note><rest/><duration>${divisions}</duration><type>quarter</type></note>`;
}

function midiToPitch(midi: number) {
  const names = [
    ['C', 0],
    ['C', 1],
    ['D', 0],
    ['D', 1],
    ['E', 0],
    ['F', 0],
    ['F', 1],
    ['G', 0],
    ['G', 1],
    ['A', 0],
    ['A', 1],
    ['B', 0],
  ] as const;
  const [step, alter] = names[((midi % 12) + 12) % 12];

  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function jsonObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

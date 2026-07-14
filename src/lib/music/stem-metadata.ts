import type { AssetKind, Json } from '@/types/werecode';

export type StemRole = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other';

export type StemInfo = {
  id: string;
  role: StemRole;
  label: string;
  tags: string[];
  /** True once a human has curated this identity (see `createStemMetadata`). */
  curated: boolean;
};

type StemAssetLike = {
  kind: string;
  metadata?: Json;
  object_path?: string;
};

type StemMetadataInput = {
  id: string;
  role: StemRole;
  label?: string | null;
  tags?: Array<string | null | undefined>;
  source?: string | null;
  /** A human curated this identity: trust `tags` verbatim, never re-derive them. */
  curated?: boolean;
  curatedAt?: string;
  extra?: Record<string, Json | undefined>;
};

export const STEM_ROLES: StemRole[] = ['vocals', 'guitar', 'bass', 'drums', 'piano', 'other'];

export const STEM_AUDIO_KINDS = [
  'stem_vocals',
  'stem_guitar',
  'stem_bass',
  'stem_drums',
  'stem_piano',
  'stem_other',
] as const satisfies readonly AssetKind[];

export const STEM_MIDI_KINDS = [
  'stem_midi_vocals',
  'stem_midi_guitar',
  'stem_midi_bass',
  'stem_midi_drums',
  'stem_midi_piano',
  'stem_midi_other',
] as const satisfies readonly AssetKind[];

export const DEFAULT_STEM_LEVELS: Record<StemRole, number> = {
  vocals: 82,
  guitar: 72,
  bass: 64,
  drums: 58,
  piano: 62,
  other: 70,
};

/**
 * The tag vocabulary the curation UI suggests and Maestro's briefs lean on. Free
 * text is still allowed — this is the well-worn path, not a cage. Guitar first:
 * telling a lead from a rhythm part is the axis Section × Role briefs consume.
 */
export const SUGGESTED_STEM_TAGS: Record<StemRole, string[]> = {
  guitar: ['lead', 'rhythm', 'clean', 'distorted', 'acoustic', 'solo', 'riff', 'fills', 'power chords', 'arpeggio'],
  bass: ['root', 'walking', 'slap', 'fingerstyle', 'pick', 'fills'],
  drums: ['groove', 'fills', 'percussion', 'cymbals'],
  piano: ['comping', 'lead', 'pads', 'organ', 'synth', 'arpeggio'],
  vocals: ['lead', 'harmony', 'backing', 'ad-libs'],
  other: ['lead', 'rhythm', 'pads', 'strings', 'horns', 'fx'],
};

export const STEM_ROLE_COLORS: Record<StemRole, string> = {
  vocals: '#c8752d',
  guitar: '#0f9b72',
  bass: '#5d7bd6',
  drums: '#c95f5f',
  piano: '#8f70d5',
  other: '#a36bb1',
};

const stemAudioKindSet = new Set<string>(STEM_AUDIO_KINDS);
const stemMidiKindSet = new Set<string>(STEM_MIDI_KINDS);

export function isStemAudioKind(kind: string): kind is (typeof STEM_AUDIO_KINDS)[number] {
  return stemAudioKindSet.has(kind);
}

export function isStemMidiKind(kind: string): kind is (typeof STEM_MIDI_KINDS)[number] {
  return stemMidiKindSet.has(kind);
}

export function stemAudioKindFromRole(role: StemRole): AssetKind {
  return `stem_${role}` as AssetKind;
}

export function stemMidiKindFromRole(role: StemRole): AssetKind {
  return `stem_midi_${role}` as AssetKind;
}

export function inferStemRoleFromText(text: string | null | undefined, isDrum = false): StemRole | null {
  const normalized = (text ?? '').toLowerCase().replace(/[_-]+/g, ' ');
  if (isDrum || /\b(drum|drums|kick|snare|perc|percussion|hat|cymbal)\b/.test(normalized)) {
    return 'drums';
  }
  if (normalized.includes('bass')) {
    return 'bass';
  }
  if (/\b(guitar|gtr|rhythm|lead)\b/.test(normalized)) {
    return 'guitar';
  }
  if (/\b(piano|keys|keyboard|synth)\b/.test(normalized)) {
    return 'piano';
  }
  if (/\b(vocals?|voice|vox|singer)\b/.test(normalized)) {
    return 'vocals';
  }
  return null;
}

export function stemRoleFromKind(kind: string): StemRole | null {
  const value = kind.startsWith('stem_midi_')
    ? kind.slice('stem_midi_'.length)
    : kind.startsWith('stem_')
      ? kind.slice('stem_'.length)
      : null;

  return toStemRole(value);
}

export function toStemRole(value: unknown): StemRole | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.toLowerCase().trim().replace(/^stem_/, '').replace(/^midi_/, '');
  return STEM_ROLES.includes(normalized as StemRole) ? (normalized as StemRole) : null;
}

export function createStemMetadata(input: StemMetadataInput): Record<string, Json> {
  const id = cleanStemText(input.id) ?? input.role;
  const label = cleanStemText(input.label) ?? labelFromStemValue(id) ?? labelFromStemValue(input.role) ?? 'Other';
  const tags = uniqueStemTags([input.role, ...(input.tags ?? [])]);
  const stem: Record<string, Json> = {
    id,
    role: input.role,
    label,
    tags,
  };
  if (input.source) {
    stem.source = input.source;
  }

  if (input.curated) {
    stem.curated = true;
  }

  const metadata: Record<string, Json | undefined> = {
    ...(input.extra ?? {}),
    stem,
    stem_id: id,
    stem_role: input.role,
    stem_label: label,
    stem_tags: tags,
    role: input.role,
  };

  if (input.source) {
    metadata.stem_source = input.source;
  }

  if (input.curated) {
    metadata.stem_identity_curated = true;
    metadata.stem_identity_curated_at = input.curatedAt ?? new Date().toISOString();
  }

  return compactJsonRecord(metadata);
}

export function getStemInfo(asset: StemAssetLike): StemInfo {
  const metadata = asRecord(asset.metadata);
  const nested = asRecord(metadata?.stem);
  const rawRole =
    toStemRole(nested?.role) ??
    toStemRole(metadata?.stem_role) ??
    toStemRole(metadata?.role) ??
    stemRoleFromKind(asset.kind) ??
    'other';
  const id =
    firstCleanString(nested?.id, metadata?.stem_id, metadata?.stem_key, metadata?.id) ??
    roleAndObjectIdentity(asset) ??
    rawRole;
  const label =
    firstCleanString(nested?.label, metadata?.stem_label, metadata?.label) ??
    labelFromStemValue(firstCleanString(metadata?.inst_class, metadata?.midi_program_name, metadata?.plugin_name)) ??
    labelFromStemValue(id) ??
    labelFromStemValue(rawRole) ??
    'Other';
  // A curated identity is the human's answer: trust the stored tags verbatim and
  // skip the pipeline's guesses (inst_class / midi_program_name / plugin_name),
  // or a tag the user deliberately removed would grow straight back.
  const curated = metadata?.stem_identity_curated === true || nested?.curated === true;
  const derived = curated
    ? []
    : [
        firstCleanString(metadata?.inst_class),
        firstCleanString(metadata?.midi_program_name),
        firstCleanString(metadata?.plugin_name),
      ];
  const tags = uniqueStemTags([
    rawRole,
    ...stringArray(nested?.tags),
    ...stringArray(metadata?.stem_tags),
    ...stringArray(metadata?.tags),
    ...derived,
  ]).filter((tag) => tag.toLowerCase() !== label.toLowerCase());

  return {
    id,
    role: rawRole,
    label,
    tags,
    curated,
  };
}

export function stemIdentity(asset: StemAssetLike) {
  const info = getStemInfo(asset);
  return `${info.role}:${info.id}`;
}

export function compareStemAssets(a: StemAssetLike, b: StemAssetLike) {
  const left = getStemInfo(a);
  const right = getStemInfo(b);
  const roleDiff = STEM_ROLES.indexOf(left.role) - STEM_ROLES.indexOf(right.role);
  if (roleDiff !== 0) {
    return roleDiff;
  }
  return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' });
}

export function isVocalStemAsset(asset: StemAssetLike) {
  const info = getStemInfo(asset);
  const label = info.label.toLowerCase();
  return info.role === 'vocals' || /\b(vocals?|voice|vox|singer)\b/.test(label);
}

export function stemColor(asset: StemAssetLike) {
  const info = getStemInfo(asset);
  return STEM_ROLE_COLORS[info.role];
}

export function stemDisplayLabel(asset: StemAssetLike) {
  return getStemInfo(asset).label;
}

export function stemDisplayTags(asset: StemAssetLike) {
  return getStemInfo(asset).tags;
}

function roleAndObjectIdentity(asset: StemAssetLike) {
  const filename = asset.object_path?.split('/').filter(Boolean).at(-1);
  return firstCleanString(filename?.replace(/\.[^.]+$/, ''));
}

function firstCleanString(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanStemText(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return null;
}

function cleanStemText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function labelFromStemValue(value: string | null | undefined) {
  const cleaned = cleanStemText(value);
  if (!cleaned) {
    return null;
  }
  return cleaned
    .replace(/^stem[_-]/i, '')
    .replace(/^stem midi[_-]/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStemTags(values: Array<string | null | undefined>) {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const tag = cleanStemText(value);
    if (!tag) {
      continue;
    }
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(tag);
  }
  return tags;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function compactJsonRecord(record: Record<string, Json | undefined>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, Json>;
}

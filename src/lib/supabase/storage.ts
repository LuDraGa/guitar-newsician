import 'server-only';

import { isWereCodeDevIdentityEnabled } from '@/lib/supabase/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export const WERECODE_STORAGE_BUCKETS = {
  sources: 'werecode-sources',
  artifacts: 'werecode-artifacts',
  previews: 'werecode-previews',
} as const;

export const WERECODE_STORAGE_BUCKET_LIST = [
  WERECODE_STORAGE_BUCKETS.sources,
  WERECODE_STORAGE_BUCKETS.artifacts,
  WERECODE_STORAGE_BUCKETS.previews,
] as const;

export type WereCodeStorageBucket = (typeof WERECODE_STORAGE_BUCKET_LIST)[number];

export class StorageInputError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'StorageInputError';
  }
}

export class StorageOperationError extends Error {
  readonly status = 502;

  constructor(message: string) {
    super(message);
    this.name = 'StorageOperationError';
  }
}

export function parseStorageBucket(value: unknown): WereCodeStorageBucket {
  if (typeof value !== 'string' || !WERECODE_STORAGE_BUCKET_LIST.includes(value as WereCodeStorageBucket)) {
    throw new StorageInputError('Invalid WereCode storage bucket');
  }

  return value as WereCodeStorageBucket;
}

export function buildUserStoragePath(userId: string, pathParts: string[]) {
  const cleanedParts = pathParts.flatMap(splitPathPart).filter(Boolean);

  if (cleanedParts[0] === userId) {
    cleanedParts.shift();
  }

  if (cleanedParts.length === 0) {
    throw new StorageInputError('Storage path must include at least one object segment');
  }

  return [userId, ...cleanedParts].join('/');
}

export function assertUserStoragePath(userId: string, objectPath: string) {
  const normalized = splitPathPart(objectPath).join('/');

  if (!normalized.startsWith(`${userId}/`)) {
    throw new StorageInputError('Storage path must be scoped to the authenticated user');
  }

  return normalized;
}

export async function createSignedStorageUploadUrl(options: {
  bucket: WereCodeStorageBucket;
  objectPath: string;
  upsert?: boolean;
}) {
  const supabase = await createStorageSigningClient();
  const uploadOptions = options.upsert === undefined ? undefined : { upsert: options.upsert };
  const { data, error } = await supabase.storage
    .from(options.bucket)
    .createSignedUploadUrl(options.objectPath, uploadOptions);

  if (error) {
    throw new StorageOperationError(error.message);
  }

  return data;
}

export async function createSignedStorageDownloadUrl(options: {
  bucket: WereCodeStorageBucket;
  objectPath: string;
  expiresIn: number;
  download?: string | boolean;
}) {
  const supabase = await createStorageSigningClient();
  const downloadOptions = options.download === undefined ? undefined : { download: options.download };
  const { data, error } = await supabase.storage
    .from(options.bucket)
    .createSignedUrl(options.objectPath, options.expiresIn, downloadOptions);

  if (error) {
    throw new StorageOperationError(error.message);
  }

  return data;
}

async function createStorageSigningClient() {
  if (isWereCodeDevIdentityEnabled()) {
    return createSupabaseAdminClient();
  }

  return createSupabaseServerClient();
}

function splitPathPart(value: string) {
  return value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(validatePathSegment);
}

function validatePathSegment(segment: string) {
  if (segment === '.' || segment === '..' || segment.includes('\0')) {
    throw new StorageInputError('Storage path contains an invalid segment');
  }

  return segment;
}

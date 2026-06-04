import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { AuthRequiredError } from '@/lib/supabase/auth';
import {
  StorageInputError,
  StorageOperationError,
  WERECODE_STORAGE_BUCKET_LIST,
  buildUserStoragePath,
  createSignedStorageDownloadUrl,
} from '@/lib/supabase/storage';
import { getWereCodeRequestContext } from '@/server/werecode/context';

export const dynamic = 'force-dynamic';

const requestSchema = z
  .object({
    bucket: z.enum(WERECODE_STORAGE_BUCKET_LIST),
    objectPath: z.string().min(1).optional(),
    pathParts: z.array(z.string().min(1)).min(1).optional(),
    expiresIn: z.number().int().min(60).max(86_400).default(3600),
    download: z.union([z.boolean(), z.string().min(1)]).optional(),
  })
  .refine((body) => Boolean(body.objectPath || body.pathParts?.length), {
    message: 'Provide objectPath or pathParts',
    path: ['objectPath'],
  });

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json().catch(() => null));
    const { user } = await getWereCodeRequestContext();
    const objectPath = buildUserStoragePath(user.id, body.pathParts ?? [body.objectPath!]);
    const data = await createSignedStorageDownloadUrl({
      bucket: body.bucket,
      objectPath,
      expiresIn: body.expiresIn,
      download: body.download,
    });

    return NextResponse.json({
      bucket: body.bucket,
      objectPath,
      expiresIn: body.expiresIn,
      ...data,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError('Invalid storage download signing request', {
        status: 400,
        code: 'invalid_request',
        details: error.flatten(),
      });
    }

    if (error instanceof AuthRequiredError) {
      return jsonError(error.message, {
        status: error.status,
        code: error.code,
      });
    }

    if (error instanceof StorageInputError || error instanceof StorageOperationError) {
      return jsonError(error.message, {
        status: error.status,
        code: error.name,
      });
    }

    return jsonError('Could not create signed download URL', {
      status: 500,
      code: 'storage_sign_download_failed',
      details: {
        message: error instanceof Error ? error.message : 'Unknown storage signing error',
      },
    });
  }
}

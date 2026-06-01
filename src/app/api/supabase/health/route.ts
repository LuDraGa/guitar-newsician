import { NextResponse } from 'next/server';

import { jsonError } from '@/lib/http/responses';
import { getCurrentUser } from '@/lib/supabase/auth';
import { getMissingSupabaseEnv, getWereCodeSchema, isWereCodeDevIdentityEnabled } from '@/lib/supabase/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = getMissingSupabaseEnv();

  if (missing.length > 0) {
    return jsonError('Supabase environment is not configured', {
      status: 503,
      code: 'supabase_env_missing',
      details: { missing },
    });
  }

  try {
    const { user, configured, error: authError } = await getCurrentUser();

    if (!configured) {
      return jsonError('Supabase auth is not configured', {
        status: 503,
        code: 'supabase_auth_unconfigured',
      });
    }

    if (!user) {
      return NextResponse.json({
        status: 'configured',
        schema: getWereCodeSchema(),
        auth: {
          signedIn: false,
          message: authError?.message ?? 'Sign in to validate authenticated RLS access.',
        },
        note: 'The werecode schema is owner-scoped and only grants table access to authenticated users.',
      });
    }

    const supabase = isWereCodeDevIdentityEnabled() ? createSupabaseAdminClient() : await createSupabaseServerClient();
    const { error: schemaError } = await supabase.from('profiles').select('id').limit(1);
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (schemaError) {
      return jsonError('Supabase schema is not reachable from Next', {
        status: 503,
        code: 'supabase_schema_unavailable',
        details: {
          schema: getWereCodeSchema(),
          code: schemaError.code,
          details: schemaError.details,
          hint: schemaError.hint,
          message: schemaError.message,
        },
      });
    }

    if (bucketError) {
      return jsonError('Supabase storage is not reachable from Next', {
        status: 503,
        code: 'supabase_storage_unavailable',
        details: {
          message: bucketError.message,
        },
      });
    }

    const bucketIds = new Set((buckets ?? []).map((bucket) => bucket.id));
    const expectedBuckets = ['werecode-sources', 'werecode-artifacts', 'werecode-previews'];
    const missingBuckets = expectedBuckets.filter((bucket) => !bucketIds.has(bucket));

    return NextResponse.json({
      status: missingBuckets.length === 0 ? 'ready' : 'degraded',
      schema: getWereCodeSchema(),
      storage: {
        expectedBuckets,
        missingBuckets,
      },
    });
  } catch (error) {
    return jsonError('Could not validate Supabase readiness', {
      status: 500,
      code: 'supabase_health_failed',
      details: {
        message: error instanceof Error ? error.message : 'Unknown Supabase health error',
      },
    });
  }
}

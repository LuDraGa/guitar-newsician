export type SupabaseBrowserEnv = {
  url: string;
  publishableKey: string;
};

export const WERECODE_SUPABASE_SCHEMA = 'werecode';

export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return { url, publishableKey };
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getWereCodeDevUserId() {
  return process.env.WERECODE_DEV_USER_ID;
}

export function getOptionalSupabaseBrowserEnv(): SupabaseBrowserEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getWereCodeSchema() {
  return WERECODE_SUPABASE_SCHEMA;
}

export function isSupabaseAuthEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' || process.env.VERCEL_ENV === 'production';
}

export function isWereCodeDevIdentityEnabled() {
  const explicitlyEnabled =
    process.env.WERECODE_ENABLE_DEV_IDENTITY === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_YOUTUBE_DOWNLOAD === 'true';
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;

  return (
    !isSupabaseAuthEnabled() &&
    explicitlyEnabled &&
    isLocalDev &&
    Boolean(getOptionalSupabaseBrowserEnv() && getSupabaseServiceRoleKey() && getWereCodeDevUserId())
  );
}

export function getMissingSupabaseEnv() {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return missing;
}

export function getMissingDevIdentityEnv() {
  const missing: string[] = [];

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!process.env.WERECODE_DEV_USER_ID) {
    missing.push('WERECODE_DEV_USER_ID');
  }

  return missing;
}

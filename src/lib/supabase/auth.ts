import 'server-only';

import type { User } from '@supabase/supabase-js';

import {
  getOptionalSupabaseBrowserEnv,
  getWereCodeDevUserId,
  isSupabaseAuthEnabled,
  isWereCodeDevIdentityEnabled,
} from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export class AuthRequiredError extends Error {
  readonly code = 'auth_required';
  readonly status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export function getAuthRuntimeState() {
  return {
    authEnabled: isSupabaseAuthEnabled(),
    configured: Boolean(getOptionalSupabaseBrowserEnv()),
    devIdentityEnabled: isWereCodeDevIdentityEnabled(),
  };
}

export async function getCurrentUser() {
  if (isWereCodeDevIdentityEnabled()) {
    return {
      user: createDevUser(),
      error: null,
      configured: true,
    };
  }

  if (!getOptionalSupabaseBrowserEnv()) {
    return {
      user: null,
      error: new Error('Supabase auth is not configured'),
      configured: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  return {
    user: error ? null : data.user,
    error,
    configured: true,
  };
}

export async function requireCurrentUser() {
  const { user, error, configured } = await getCurrentUser();

  if (!configured) {
    throw new AuthRequiredError('Supabase auth is not configured');
  }

  if (!user) {
    throw new AuthRequiredError(error?.message ?? 'Authentication required');
  }

  return user;
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastSignInAt: user.last_sign_in_at,
  };
}

function createDevUser() {
  const userId = getWereCodeDevUserId();

  if (!userId) {
    throw new AuthRequiredError('Missing WERECODE_DEV_USER_ID');
  }

  return {
    id: userId,
    email: 'local-dev@werecode.local',
    phone: undefined,
    app_metadata: {
      provider: 'dev',
    },
    user_metadata: {
      name: 'Local Dev User',
    },
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    last_sign_in_at: new Date(0).toISOString(),
  } as User;
}

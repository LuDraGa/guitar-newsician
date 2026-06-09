'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  clearWereCodeDataCache,
  reconcileWereCodeCacheOwner,
} from '@/lib/client-cache/werecode-data-cache';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type PublicUser = {
  id: string;
  email?: string;
  userMetadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
};

export type SessionPayload = {
  authEnabled: boolean;
  configured: boolean;
  user: PublicUser | null;
};

type SessionContextValue = {
  /** `null` while the first session check is still in flight. */
  session: SessionPayload | null;
  busy: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Single source of truth for auth state across the shell. Fetches
 * `/api/auth/session` once per mount and exposes sign-in / sign-out so any
 * surface (topbar, Library lock, Studio picker) can read identity and drive the
 * gate without each re-fetching or re-implementing the Supabase calls.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) {
        setSession({ authEnabled: false, configured: false, user: null });
        return;
      }
      const payload = (await response.json()) as SessionPayload;
      if (payload.user?.id) {
        // Clear another account's persisted cache before showing this session.
        reconcileWereCodeCacheOwner(payload.user.id);
      }
      setSession(payload);
    } catch {
      setSession({ authEnabled: false, configured: false, user: null });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reload]);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    // On success the browser redirects to Google, so we intentionally stay busy.
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    clearWereCodeDataCache();
    await reload();
    setBusy(false);
  }, [reload]);

  return (
    <SessionContext.Provider value={{ session, busy, error, signIn, signOut, reload }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

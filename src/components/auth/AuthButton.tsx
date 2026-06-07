'use client';

import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { clearWereCodeDataCache, reconcileWereCodeCacheOwner } from '@/lib/client-cache/werecode-data-cache';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type PublicUser = {
  id: string;
  email?: string;
  userMetadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
};

type SessionPayload = {
  authEnabled: boolean;
  configured: boolean;
  user: PublicUser | null;
};

export function AuthButton() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSession() {
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    clearWereCodeDataCache();
    await loadSession();
    setBusy(false);
  }

  if (session === null) {
    return <span className="muted text-xs">Checking auth...</span>;
  }

  if (!session?.configured) {
    return <span className="muted text-xs">Supabase not configured</span>;
  }

  if (!session.user) {
    return (
      <div className="flex items-center gap-2">
        {error ? <span className="max-w-48 truncate text-xs text-red-300">{error}</span> : null}
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="pill ghost sm"
        >
          <span className="dot">
            <LogIn className="h-3.5 w-3.5" />
          </span>
          Google
        </button>
      </div>
    );
  }

  const displayName = session.user.userMetadata?.full_name ?? session.user.userMetadata?.name ?? session.user.email ?? 'Account';

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[180px] items-center gap-2 truncate text-sm text-[var(--muted)] sm:flex">
        <UserCircle className="h-4 w-4 shrink-0 text-[var(--accent-ink)]" />
        <span className="truncate">{displayName}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="iconbtn"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

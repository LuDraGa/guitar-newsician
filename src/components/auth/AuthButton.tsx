'use client';

import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  async function loadSession() {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) {
      setSession({ authEnabled: false, configured: false, user: null });
      return;
    }
    setSession((await response.json()) as SessionPayload);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function signIn() {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
      },
    });
  }

  async function signOut() {
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await loadSession();
    setBusy(false);
  }

  if (!session?.configured) {
    return <span className="muted text-xs">Supabase not configured</span>;
  }

  if (!session.user) {
    return (
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" />
        Google
      </button>
    );
  }

  const displayName = session.user.userMetadata?.full_name ?? session.user.userMetadata?.name ?? session.user.email ?? 'Account';

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[180px] items-center gap-2 truncate text-sm text-slate-200 sm:flex">
        <UserCircle className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
        <span className="truncate">{displayName}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

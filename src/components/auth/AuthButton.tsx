'use client';

import { LogIn, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '@/components/auth/session-context';

export function AuthButton() {
  const { session, busy, error, signIn, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (session === null) {
    return <span className="muted text-xs">Checking…</span>;
  }

  if (!session.configured) {
    return <span className="muted text-xs">Supabase not configured</span>;
  }

  if (!session.user) {
    return (
      <div className="flex items-center gap-2">
        {error ? <span className="max-w-44 truncate text-xs text-[var(--danger)]">{error}</span> : null}
        <button type="button" onClick={() => void signIn()} disabled={busy} className="pill sm">
          <span className="dot">
            <LogIn className="h-3.5 w-3.5" />
          </span>
          {busy ? 'Opening…' : 'Sign in'}
        </button>
      </div>
    );
  }

  const user = session.user;
  const displayName =
    user.userMetadata?.full_name ?? user.userMetadata?.name ?? user.email ?? 'Account';
  const avatarUrl = user.userMetadata?.avatar_url ?? user.userMetadata?.picture ?? null;
  const initials = getInitials(displayName);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="wc-avatar"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[12.5px] font-bold tracking-tight">{initials}</span>
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Account"
          className="wc-pop absolute right-0 top-[calc(100%+8px)] z-50 w-60 max-w-[calc(100vw-32px)] p-1.5"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="wc-avatar shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[12.5px] font-bold tracking-tight">{initials}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--ink)]">{displayName}</span>
              {user.email ? (
                <span className="block truncate text-xs text-[var(--muted)]">{user.email}</span>
              ) : null}
            </span>
          </div>

          <div className="my-1 h-px bg-[var(--line-2)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void signOut();
            }}
            disabled={busy}
            className="wc-menu-item"
          >
            <LogOut className="h-4 w-4 text-[var(--muted)]" />
            {busy ? 'Signing out…' : 'Sign out'}
          </button>

          {error ? <p className="px-2.5 pb-1 pt-0.5 text-xs text-[var(--danger)]">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'WC';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

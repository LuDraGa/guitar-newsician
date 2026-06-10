'use client';

import { Loader2, Music2, Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

import { useSession } from '@/components/auth/session-context';
import { CoverArt, StatusDot } from '@/components/werecode/WereCodePrimitives';
import { useWereCodeDataCache } from '@/lib/client-cache/werecode-data-cache';
import type { SongSummary } from '@/types/werecode-client';

// How many rows the palette shows. Recents (empty query) stay short so the
// dialog reads as a calm jump-list; a real query opens it up to a scrollable
// result set.
const RECENT_LIMIT = 7;
const RESULT_LIMIT = 25;

/**
 * Global "Quick open" command palette behind the topbar Search button and
 * Cmd/Ctrl+K. Navigational, not a Library filter: it searches the user's songs
 * (shared `useWereCodeDataCache`) and jumps to a song's Studio. Rendered once
 * in the AppShell; owns both its trigger and overlay so state stays local.
 */
export function CommandSearch() {
  const router = useRouter();
  const { session } = useSession();
  const songs = useWereCodeDataCache((state) => state.songs);
  const setCachedSongs = useWereCodeDataCache((state) => state.setSongs);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);

  const listId = useId();
  const locked = Boolean(session && session.authEnabled && !session.user);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const activate = useCallback(() => {
    if (openRef.current) {
      return;
    }
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current) {
      return;
    }
    setOpen(false);
    setQuery('');
    const target = previouslyFocused.current ?? triggerRef.current;
    window.setTimeout(() => target?.focus?.(), 0);
  }, []);

  // Cmd/Ctrl+K toggles the palette from anywhere. Registered in the capture
  // phase with stopImmediatePropagation so it fires before — and suppresses —
  // the lyrics editor's bare-`k` window handler in StudioClient, which would
  // otherwise stamp a line on the same keystroke.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (openRef.current) {
          close();
        } else {
          activate();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [activate, close]);

  const loadSongs = useCallback(async () => {
    if (useWereCodeDataCache.getState().songsLoaded) {
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/songs?limit=100', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = (await response.json()) as { songs: SongSummary[] };
      setCachedSongs(payload.songs);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your songs');
    } finally {
      setLoading(false);
    }
  }, [setCachedSongs]);

  // Warm the shared cache on first open if Library/Studio haven't already. The
  // load is deferred a tick (matching StudioPicker/LibraryClient) so the
  // setState lands outside the synchronous effect body.
  useEffect(() => {
    if (!open || locked) {
      return;
    }
    const timer = window.setTimeout(() => void loadSongs(), 0);
    return () => window.clearTimeout(timer);
  }, [open, locked, loadSongs]);

  // Focus the input when the dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return songs.slice(0, RECENT_LIMIT);
    }
    return songs
      .filter((song) =>
        [song.title, song.artist, song.album, song.source_url].some((value) =>
          value?.toLowerCase().includes(normalized)
        )
      )
      .slice(0, RESULT_LIMIT);
  }, [query, songs]);

  const safeActive = results.length > 0 ? Math.min(activeIndex, results.length - 1) : -1;

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    if (!open || safeActive < 0) {
      return;
    }
    document.getElementById(`${listId}-opt-${safeActive}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, safeActive, listId]);

  const selectSong = useCallback(
    (song: SongSummary) => {
      setOpen(false);
      setQuery('');
      router.push(`/app/studio/${song.id}` as Route);
    },
    [router]
  );

  function onDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const song = results[safeActive];
      if (song) {
        selectSong(song);
      }
    }
  }

  const trimmedQuery = query.trim();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={activate}
        className="iconbtn"
        aria-label="Search songs"
        aria-keyshortcuts="Meta+K Control+K"
        title="Search songs (⌘K)"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-[oklch(0.2_0.006_60_/_0.28)] px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search songs"
            onKeyDown={onDialogKeyDown}
            className="wc-pop w-full max-w-[560px] overflow-hidden"
            style={{ transformOrigin: 'top center' }}
          >
            <div className="flex items-center gap-3 border-b border-[var(--line-2)] px-4">
              <Search className="h-[18px] w-[18px] shrink-0 text-[var(--faint)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search songs and artists"
                className="h-14 w-full min-w-0 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={safeActive >= 0 ? `${listId}-opt-${safeActive}` : undefined}
                aria-label="Search songs and artists"
              />
              <Kbd className="shrink-0">Esc</Kbd>
            </div>

            <div id={listId} role="listbox" aria-label="Songs" className="max-h-[420px] overflow-y-auto p-1.5">
              {locked ? (
                <Empty
                  title="Sign in to search"
                  body="Your songs live behind your account. Sign in to open one from anywhere."
                />
              ) : loading ? (
                <div className="flex items-center gap-3 px-2.5 py-6 text-sm text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--faint)]" />
                  Loading your songs…
                </div>
              ) : loadError ? (
                <div className="chip danger m-1 min-h-11 w-[calc(100%-8px)] justify-start rounded-[10px] px-3">
                  {loadError}
                </div>
              ) : songs.length === 0 ? (
                <Empty title="No songs yet" body="Import a track in your Library, then jump back here.">
                  <Link href="/app/library" onClick={() => close()} className="pill sm mt-4">
                    <span className="dot">
                      <Music2 className="h-3.5 w-3.5" />
                    </span>
                    Open library
                  </Link>
                </Empty>
              ) : results.length === 0 ? (
                <Empty title="No matches" body={`Nothing in your library matches “${trimmedQuery}”.`} />
              ) : (
                <>
                  <div className="label px-2.5 pb-1.5 pt-2">{trimmedQuery ? 'Songs' : 'Recent'}</div>
                  {results.map((song, index) => {
                    const isActive = index === safeActive;
                    return (
                      <button
                        key={song.id}
                        id={`${listId}-opt-${index}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => selectSong(song)}
                        onMouseMove={() => setActiveIndex(index)}
                        className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition"
                        // Inline so the Rosin-soft highlight wins over the unlayered
                        // `button { background: none }` reset, which outranks any
                        // @layer-utilities Tailwind background. Hover promotes a row to
                        // active via onMouseMove, so this covers pointer + keyboard.
                        style={{ background: isActive ? 'var(--accent-soft)' : undefined }}
                      >
                        <CoverArt id={song.id} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--ink)]">{song.title}</span>
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {song.artist ?? 'Unknown artist'}
                          </span>
                        </span>
                        <StatusDot status={song.status} />
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-[var(--line-2)] px-4 py-2.5 text-[12px] text-[var(--faint)]">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                open
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`mono inline-grid min-w-[20px] place-items-center rounded-[6px] bg-[var(--card-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-2)] ${className}`}
    >
      {children}
    </kbd>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div>
        <Music2 className="mx-auto h-9 w-9 text-[var(--faint)]" />
        <div className="mt-3 text-base font-bold text-[var(--ink)]">{title}</div>
        <p className="mx-auto mt-1.5 max-w-[300px] text-sm leading-6 text-[var(--muted)]">{body}</p>
        {children}
      </div>
    </div>
  );
}

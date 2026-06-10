'use client';

import { Loader2, Music2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useSession } from '@/components/auth/session-context';
import { CoverArt, ReadinessChips, StatusDot } from '@/components/werecode/WereCodePrimitives';
import { useWereCodeDataCache } from '@/lib/client-cache/werecode-data-cache';
import type { SongSummary } from '@/types/werecode-client';
import { fetchJson } from './studio-utils';

/**
 * The Studio's no-song state. Studio is the per-song workbench, so reaching it
 * without a song lands here: a calm picker over the user's library (shared cache
 * with Library, so the list is already warm), or the sign-in gate when locked.
 */
export function StudioPicker() {
  const { session } = useSession();
  const songs = useWereCodeDataCache((state) => state.songs);
  const songsLoaded = useWereCodeDataCache((state) => state.songsLoaded);
  const setCachedSongs = useWereCodeDataCache((state) => state.setSongs);
  const [loading, setLoading] = useState(!songsLoaded);
  const [error, setError] = useState<string | null>(null);

  const sessionResolved = session !== null;
  const locked = Boolean(session && session.authEnabled && !session.user);

  const loadSongs = useCallback(async () => {
    if (useWereCodeDataCache.getState().songsLoaded) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ songs: SongSummary[] }>('/api/songs?limit=100');
      setCachedSongs(payload.songs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your songs');
    } finally {
      setLoading(false);
    }
  }, [setCachedSongs]);

  useEffect(() => {
    if (!sessionResolved || locked) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSongs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [sessionResolved, locked, loadSongs]);

  if (!sessionResolved || (loading && !locked)) {
    return (
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="surface wc-rise mx-auto mt-8 grid min-h-[320px] max-w-[1180px] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--faint)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto">
      <section className="wc-rise mx-auto max-w-[1180px] pb-16">
        <header className="pb-7 pt-8">
          <div className="label mb-3">
            Studio - {songs.length} {songs.length === 1 ? 'song' : 'songs'}
          </div>
          <h1 className="display text-[clamp(34px,5vw,56px)]">Open a song</h1>
          <p className="mt-4 max-w-[440px] text-[16px] leading-7 text-[var(--muted)]">
            Pick a track to take to the bench.
          </p>
        </header>

        {error && (
          <div className="chip danger mb-4 min-h-11 w-full justify-start rounded-[12px] px-4">
            {error}
          </div>
        )}

        {songs.length === 0 ? (
          <div className="surface grid min-h-[320px] place-items-center px-6 py-14 text-center">
            <div>
              <Music2 className="mx-auto h-11 w-11 text-[var(--faint)]" />
              <h2 className="display mt-4 text-2xl">No songs yet</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Import a song in your Library, then bring it to the bench.
              </p>
              <Link href="/app/library" className="pill mt-5">
                <span className="dot">
                  <Music2 className="h-3.5 w-3.5" />
                </span>
                Open library
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {songs.map((song) => (
              <PickerCard key={song.id} song={song} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PickerCard({ song }: { song: SongSummary }) {
  return (
    <Link
      href={`/app/studio/${song.id}` as Route}
      className="surface group flex min-h-[160px] flex-col gap-4 p-[18px] text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center gap-3">
        <CoverArt id={song.id} size={52} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{song.title}</div>
          <div className="mt-1 truncate text-sm text-[var(--muted)]">{song.artist ?? 'Unknown artist'}</div>
        </div>
      </div>

      <ReadinessChips items={pickerReadiness(song)} />

      <div className="mt-auto pt-1">
        <StatusDot status={song.status} />
      </div>
    </Link>
  );
}

function pickerReadiness(song: SongSummary) {
  return [
    { label: 'Stems', ready: song.has_stems },
    { label: 'Lyrics', ready: song.has_plain_lyrics || song.has_synced_lyrics },
    { label: 'MIDI', ready: song.has_midi },
  ];
}

'use client';

import { Pause, Play, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRow } from '@/types/werecode';
import { assetLabel, formatDate, signDownload } from './studio-utils';

type StemMixerPanelProps = {
  assets: AssetRow[];
  onOpenAsset: (asset: AssetRow) => void;
};

type StemMixState = {
  muted: boolean;
  solo: boolean;
  volume: number;
};

const stemOrder = ['stem_vocals', 'stem_guitar', 'stem_piano', 'stem_drums', 'stem_bass', 'stem_other'];
const stemKindSet = new Set(stemOrder);
const defaultStemMixState: StemMixState = {
  muted: false,
  solo: false,
  volume: 0.85,
};

export function StemMixerPanel({ assets, onOpenAsset }: StemMixerPanelProps) {
  const stemAssets = useMemo(
    () => assets.filter((asset) => stemKindSet.has(asset.kind)).sort((a, b) => stemOrder.indexOf(a.kind) - stemOrder.indexOf(b.kind)),
    [assets]
  );
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [mixState, setMixState] = useState<Record<string, StemMixState>>({});
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [playing, setPlaying] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());

  const ensureMixState = useCallback((assetList: AssetRow[]) => {
    setMixState((current) => {
      const next = { ...current };
      for (const asset of assetList) {
        next[asset.id] ??= {
          muted: false,
          solo: false,
          volume: 0.85,
        };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ensureMixState(stemAssets);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [ensureMixState, stemAssets]);

  useEffect(() => {
    let cancelled = false;

    async function signStems() {
      setSignError(null);
      if (stemAssets.length === 0) {
        setSignedUrls({});
        return;
      }

      try {
        const entries = await Promise.all(
          stemAssets.map(async (asset) => {
            const url = await signDownload(asset);
            return [asset.id, url] as const;
          })
        );

        if (!cancelled) {
          setSignedUrls(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setSignError(error instanceof Error ? error.message : 'Could not sign stem assets');
        }
      }
    }

    const timer = window.setTimeout(() => {
      void signStems();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stemAssets]);

  useEffect(() => {
    const anySolo = Object.values(mixState).some((stem) => stem.solo);
    for (const asset of stemAssets) {
      const audio = audioRefs.current.get(asset.id);
      const state = mixState[asset.id];
      if (!audio || !state) {
        continue;
      }

      const silenced = state.muted || (anySolo && !state.solo);
      audio.volume = silenced ? 0 : Math.min(1, Math.max(0, state.volume * masterVolume));
    }
  }, [masterVolume, mixState, stemAssets]);

  async function playAll() {
    setSignError(null);
    const audios = stemAssets.map((asset) => audioRefs.current.get(asset.id)).filter(Boolean) as HTMLAudioElement[];
    if (audios.length === 0) {
      return;
    }

    const anchorTime = audios[0]?.currentTime ?? 0;
    for (const audio of audios) {
      audio.currentTime = anchorTime;
    }

    try {
      await Promise.all(audios.map((audio) => audio.play()));
      setPlaying(true);
    } catch (error) {
      setSignError(error instanceof Error ? error.message : 'Could not start stem playback');
      setPlaying(false);
    }
  }

  function pauseAll() {
    for (const audio of audioRefs.current.values()) {
      audio.pause();
    }
    setPlaying(false);
  }

  function resetAll() {
    for (const audio of audioRefs.current.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
  }

  function updateStem(assetId: string, patch: Partial<StemMixState>) {
    setMixState((current) => ({
      ...current,
      [assetId]: {
        ...defaultStemMixState,
        ...current[assetId],
        ...patch,
      },
    }));
  }

  function soloStem(assetId: string) {
    setMixState((current) => {
      const currentSolo = current[assetId]?.solo ?? false;
      const next = { ...current };
      for (const asset of stemAssets) {
        next[asset.id] = {
          ...defaultStemMixState,
          ...current[asset.id],
          solo: asset.id === assetId ? !currentSolo : false,
        };
      }
      return next;
    });
  }

  if (stemAssets.length === 0) {
    return null;
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent-strong)]" />
          <h2 className="font-medium">Stem Mixer</h2>
          <span className="muted text-xs">{stemAssets.length} stem(s)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (playing ? pauseAll() : void playAll())}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <label className="flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100">
            <Volume2 className="h-4 w-4 text-slate-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(masterVolume * 100)}
              onChange={(event) => setMasterVolume(Number(event.target.value) / 100)}
              className="w-24 accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>

      {signError && <div className="border-b border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{signError}</div>}

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {stemAssets.map((asset) => {
          const state = mixState[asset.id] ?? { muted: false, solo: false, volume: 0.85 };
          const signedUrl = signedUrls[asset.id];
          const anySolo = Object.values(mixState).some((stem) => stem.solo);
          const silenced = state.muted || (anySolo && !state.solo);

          return (
            <div key={asset.id} className={`rounded-md border border-white/10 bg-black/20 p-3 ${silenced ? 'opacity-55' : ''}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-white">{assetLabel(asset.kind)}</h3>
                  <p className="muted mt-1 text-xs">{formatDate(asset.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateStem(asset.id, { muted: !state.muted })}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs ${
                      state.muted ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    title="Mute"
                  >
                    {state.muted ? <VolumeX className="h-3.5 w-3.5" /> : 'M'}
                  </button>
                  <button
                    type="button"
                    onClick={() => soloStem(asset.id)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs ${
                      state.solo ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </div>

              {signedUrl ? (
                <audio
                  ref={(node) => {
                    if (node) {
                      audioRefs.current.set(asset.id, node);
                    } else {
                      audioRefs.current.delete(asset.id);
                    }
                  }}
                  src={signedUrl}
                  preload="metadata"
                  onEnded={() => setPlaying(false)}
                  className="hidden"
                />
              ) : null}

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(state.volume * 100)}
                  onChange={(event) => updateStem(asset.id, { volume: Number(event.target.value) / 100 })}
                  className="h-2 flex-1 accent-[var(--accent)]"
                />
                <span className="w-10 text-right font-mono text-xs text-slate-300">{Math.round(state.volume * 100)}</span>
              </div>

              <div className="mt-3 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAsset(asset)}
                  className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-100 hover:bg-white/10"
                >
                  Open
                </button>
                {!signedUrl && <span className="muted text-xs">Signing...</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

'use client';

import { AlertTriangle, ExternalLink, FileMusic, Guitar, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  getCachedSignedAssetUrl,
  useWereCodeDataCache,
} from '@/lib/client-cache/werecode-data-cache';
import { parseMusicXmlPreview, type MusicXmlPreviewData } from '@/lib/music/musicxml';
import type { AssetSummary } from '@/types/werecode-client';
import { EmptyPreview, MeasureNoteList, PreviewMetrics, SheetPreview, TabPreview } from './MusicXmlPreviewVisuals';
import { assetLabel, formatDate, signDownloads } from './studio-utils';

type PreviewMode = 'sheet' | 'tab';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: MusicXmlPreviewData }
  | { status: 'error'; message: string };

type MusicXmlPreviewPanelProps = {
  title: string;
  asset: AssetSummary | undefined;
  fallback: string;
  mode: PreviewMode;
  estimatedFromScore?: boolean;
  onOpenAsset: (asset: AssetSummary) => void;
};

export function MusicXmlPreviewPanel({
  title,
  asset,
  fallback,
  mode,
  estimatedFromScore = false,
  onOpenAsset,
}: MusicXmlPreviewPanelProps) {
  const cachedPreview = useWereCodeDataCache((state) => (asset ? state.musicXmlPreviewsByAssetId[asset.id]?.preview : null));
  const setCachedMusicXmlPreview = useWereCodeDataCache((state) => state.setMusicXmlPreview);
  const setCachedSignedAssetUrls = useWereCodeDataCache((state) => state.setSignedAssetUrls);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    let active = true;

    async function loadMusicXml(currentAsset: AssetSummary) {
      setLoadState({ status: 'loading' });

      try {
        if (!currentAsset.song_id) {
          throw new Error('Asset is not attached to a song');
        }

        let signedUrl = getCachedSignedAssetUrl(currentAsset.id);
        if (!signedUrl) {
          const [signedAssetUrl] = await signDownloads(currentAsset.song_id, [currentAsset.id]);
          if (!signedAssetUrl) {
            throw new Error('Could not sign MusicXML asset');
          }
          setCachedSignedAssetUrls([signedAssetUrl]);
          signedUrl = signedAssetUrl.signedUrl;
        }

        const response = await fetch(signedUrl, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error(`Could not fetch MusicXML asset: ${response.status}`);
        }

        const text = await response.text();
        const preview = parseMusicXmlPreview(text);
        if (active) {
          setCachedMusicXmlPreview(currentAsset.id, preview);
          setLoadState({ status: 'ready', preview });
        }
      } catch (error) {
        if (active) {
          setLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not load MusicXML preview',
          });
        }
      }
    }

    if (!asset) {
      const timer = window.setTimeout(() => {
        setLoadState({ status: 'idle' });
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    if (cachedPreview) {
      const timer = window.setTimeout(() => {
        setLoadState({ status: 'ready', preview: cachedPreview });
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    const timer = window.setTimeout(() => {
      void loadMusicXml(asset);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [asset, cachedPreview, setCachedMusicXmlPreview, setCachedSignedAssetUrls]);

  if (!asset) {
    return <EmptyPreview text={fallback} />;
  }

  const sourceLabel = estimatedFromScore ? 'score MusicXML' : assetLabel(asset.kind);

  return (
    <div className="rounded-md border border-white/10 bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'tab' ? (
              <Guitar className="h-4 w-4 text-[var(--accent-strong)]" />
            ) : (
              <FileMusic className="h-4 w-4 text-[var(--accent-strong)]" />
            )}
            <h3 className="font-medium text-white">{title}</h3>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300">{sourceLabel}</span>
          </div>
          <p className="muted mt-1 truncate text-sm">
            {asset.content_type ?? 'unknown'} - {formatDate(asset.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenAsset(asset)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4" />
          Open
        </button>
      </div>

      <div className="p-4">
        {loadState.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading MusicXML preview
          </div>
        )}

        {loadState.status === 'error' && (
          <div className="flex items-start gap-3 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadState.message}</span>
          </div>
        )}

        {loadState.status === 'ready' && (
          <div className="space-y-4">
            <PreviewMetrics preview={loadState.preview} />
            {mode === 'tab' ? <TabPreview preview={loadState.preview} /> : <SheetPreview preview={loadState.preview} />}
            <MeasureNoteList measures={loadState.preview.measures} />
          </div>
        )}
      </div>
    </div>
  );
}

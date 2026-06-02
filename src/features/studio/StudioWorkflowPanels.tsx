'use client';

import { CheckCircle2, ExternalLink, FileMusic, ListMusic, Music2, Scissors } from 'lucide-react';

import { formatTime, parseLrc } from '@/lib/music/lrc';
import type { AssetRow, LyricsRow } from '@/types/werecode';
import { assetLabel, formatBytes, formatDate, statusClass } from './studio-utils';

type StudioWorkflowPanelsProps = {
  assets: AssetRow[];
  sourceAsset: AssetRow | undefined;
  syncedLyrics: LyricsRow | undefined;
  plainLyrics: LyricsRow | undefined;
  noteEventsAsset: AssetRow | undefined;
  musicXmlAsset: AssetRow | undefined;
  running: string | null;
  onOpenAsset: (asset: AssetRow) => void;
  onRunMusicXml: () => void;
};

const stemKinds = new Set(['stem_vocals', 'stem_drums', 'stem_bass', 'stem_other', 'stem_guitar', 'stem_piano']);
const midiKinds = new Set(['midi', 'note_events', 'musicxml', 'tab_musicxml']);

export function StudioWorkflowPanels({
  assets,
  sourceAsset,
  syncedLyrics,
  plainLyrics,
  noteEventsAsset,
  musicXmlAsset,
  running,
  onOpenAsset,
  onRunMusicXml,
}: StudioWorkflowPanelsProps) {
  const stemAssets = assets.filter((asset) => stemKinds.has(asset.kind));
  const midiAssets = assets.filter((asset) => midiKinds.has(asset.kind));
  const syncedLines = syncedLyrics?.lyrics_type === 'lrc' ? parseLrc(syncedLyrics.content ?? '').slice(0, 8) : [];
  const readiness = [
    { label: 'Audio', ready: Boolean(sourceAsset) },
    { label: 'Stems', ready: stemAssets.length > 0 },
    { label: 'Lyrics', ready: Boolean(plainLyrics ?? syncedLyrics) },
    { label: 'Karaoke', ready: Boolean(syncedLyrics) },
    { label: 'MIDI', ready: midiAssets.some((asset) => asset.kind === 'midi') },
    { label: 'Score', ready: Boolean(musicXmlAsset) },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="surface p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-[var(--accent-strong)]" />
            <h2 className="font-medium">Workflow State</h2>
          </div>
          {sourceAsset && <span className={`rounded-md border px-2 py-1 text-xs ${statusClass('ready')}`}>audio ready</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {readiness.map((item) => (
            <div key={item.label} className="flex h-11 items-center justify-between rounded-md border border-white/10 bg-black/20 px-3">
              <span className="text-sm text-slate-200">{item.label}</span>
              <CheckCircle2 className={`h-4 w-4 ${item.ready ? 'text-[var(--accent-strong)]' : 'text-slate-600'}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-[var(--accent-strong)]" />
            <h2 className="font-medium">Stems</h2>
          </div>
          <span className="muted text-xs">{stemAssets.length} asset(s)</span>
        </div>
        {stemAssets.length > 0 ? (
          <div className="grid gap-2">
            {stemAssets.map((asset) => (
              <AssetRowButton key={asset.id} asset={asset} onOpenAsset={onOpenAsset} />
            ))}
          </div>
        ) : (
          <EmptyPanelText text="No stem assets yet." />
        )}
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListMusic className="h-4 w-4 text-[var(--accent-strong)]" />
            <h2 className="font-medium">Karaoke</h2>
          </div>
          {syncedLyrics && <span className={`rounded-md border px-2 py-1 text-xs ${statusClass('ready')}`}>synced</span>}
        </div>
        {syncedLines.length > 0 ? (
          <div className="max-h-56 overflow-auto rounded-md border border-white/10 bg-black/20">
            {syncedLines.map((line) => (
              <div key={`${line.timestamp}-${line.text}`} className="grid grid-cols-[56px_1fr] gap-3 border-b border-white/5 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-slate-500">{formatTime(line.timestamp)}</span>
                <span className="text-slate-200">{line.text}</span>
              </div>
            ))}
          </div>
        ) : syncedLyrics ? (
          <EmptyPanelText text="Synced alignment JSON is saved." />
        ) : plainLyrics ? (
          <EmptyPanelText text="Plain lyrics are saved. Run Karaoke to create synced lyrics." />
        ) : (
          <EmptyPanelText text="No lyrics saved yet." />
        )}
      </section>

      <section className="surface p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileMusic className="h-4 w-4 text-[var(--accent-strong)]" />
            <h2 className="font-medium">MIDI And Score</h2>
          </div>
          <button
            type="button"
            onClick={onRunMusicXml}
            disabled={!noteEventsAsset || Boolean(running)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 px-2 text-xs text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            MusicXML
          </button>
        </div>
        {midiAssets.length > 0 ? (
          <div className="grid gap-2">
            {midiAssets.map((asset) => (
              <AssetRowButton key={asset.id} asset={asset} onOpenAsset={onOpenAsset} />
            ))}
          </div>
        ) : (
          <EmptyPanelText text="No MIDI or score artifacts yet." />
        )}
      </section>
    </div>
  );
}

function AssetRowButton({ asset, onOpenAsset }: { asset: AssetRow; onOpenAsset: (asset: AssetRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenAsset(asset)}
      className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/10"
    >
      <span>
        <span className="block text-sm font-medium text-white">{assetLabel(asset.kind)}</span>
        <span className="muted mt-1 block text-xs">
          {formatBytes(asset.byte_size)} - {formatDate(asset.created_at)}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function EmptyPanelText({ text }: { text: string }) {
  return <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">{text}</div>;
}

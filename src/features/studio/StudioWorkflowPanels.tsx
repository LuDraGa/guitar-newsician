'use client';

import { ExternalLink, FileMusic, ListMusic, Music2, Scissors } from 'lucide-react';

import { ReadinessChips } from '@/components/werecode/WereCodePrimitives';
import { formatTime, parseLrc } from '@/lib/music/lrc';
import type { AssetRow, LyricsRow } from '@/types/werecode';
import { assetLabel, formatBytes, formatDate } from './studio-utils';

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
      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-[var(--accent-ink)]" />
            <h2 className="font-semibold">Workflow state</h2>
          </div>
          {sourceAsset && <span className="chip live">audio ready</span>}
        </div>
        <ReadinessChips items={readiness} />
      </section>

      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-[var(--accent-ink)]" />
            <h2 className="font-semibold">Stems</h2>
          </div>
          <span className="chip">{stemAssets.length} asset(s)</span>
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

      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListMusic className="h-4 w-4 text-[var(--accent-ink)]" />
            <h2 className="font-semibold">Karaoke</h2>
          </div>
          {syncedLyrics && <span className="chip live">synced</span>}
        </div>
        {syncedLines.length > 0 ? (
          <div className="max-h-56 overflow-auto rounded-[12px] bg-[var(--paper)] shadow-[inset_0_0_0_1px_var(--line-2)]">
            {syncedLines.map((line) => (
              <div key={`${line.timestamp}-${line.text}`} className="grid grid-cols-[56px_1fr] gap-3 border-b border-[var(--line-2)] px-3 py-2 text-sm last:border-b-0">
                <span className="mono text-xs text-[var(--faint)]">{formatTime(line.timestamp)}</span>
                <span>{line.text}</span>
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

      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileMusic className="h-4 w-4 text-[var(--accent-ink)]" />
            <h2 className="font-semibold">MIDI and score</h2>
          </div>
          <button
            type="button"
            onClick={onRunMusicXml}
            disabled={!noteEventsAsset || Boolean(running)}
            className="pill ghost sm"
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
      className="surface-flat flex min-h-14 items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--card-2)]"
    >
      <span>
        <span className="block text-sm font-semibold">{assetLabel(asset.kind)}</span>
        <span className="muted mt-1 block text-xs">
          {formatBytes(asset.byte_size)} - {formatDate(asset.created_at)}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function EmptyPanelText({ text }: { text: string }) {
  return <div className="surface-flat p-3 text-sm text-[var(--muted)]">{text}</div>;
}

'use client';

import {
  Bot,
  FileMusic,
  Guitar,
  Keyboard,
  Music,
  Sparkles,
  Waves,
} from 'lucide-react';

import type { AssetRow, SongRow } from '@/types/werecode';
import { TranscriptionAssistantPanel } from './TranscriptionAssistantPanel';
import { ArtifactPanel, PianoPanel, WaveformPanel } from './TranscriptionPanels';
import { useTranscriptionWorkspace, type TranscriptionView } from './useTranscriptionWorkspace';

type TranscriptionWorkspaceProps = {
  song: SongRow | null;
  assets: AssetRow[];
  sourceAsset: AssetRow | undefined;
  audioUrl: string | null;
  running: string | null;
  onOpenAsset: (asset: AssetRow) => void;
  onRunWorkflow: (name: string, endpoint: string, payload: Record<string, unknown>) => void;
};

const viewConfig: Array<{ id: TranscriptionView; label: string; icon: typeof Waves }> = [
  { id: 'waveform', label: 'Waveform', icon: Waves },
  { id: 'piano', label: 'Piano', icon: Keyboard },
  { id: 'sheet', label: 'Sheet', icon: FileMusic },
  { id: 'tab', label: 'Tab', icon: Guitar },
  { id: 'assistant', label: 'Assistant', icon: Bot },
];

export function TranscriptionWorkspace({
  song,
  assets,
  sourceAsset,
  audioUrl,
  running,
  onOpenAsset,
  onRunWorkflow,
}: TranscriptionWorkspaceProps) {
  const workspace = useTranscriptionWorkspace({ song, assets, audioUrl });
  const {
    activeView,
    setActiveView,
    midiData,
    midiError,
    waveform,
    waveformError,
    selectedSection,
    setSelectedSection,
    sessions,
    assistantInput,
    setAssistantInput,
    assistantError,
    assistantMessage,
    assistantBusy,
    noteEventsAsset,
    musicXmlAsset,
    tabAsset,
    createEditSession,
    applySession,
    rejectSession,
  } = workspace;

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
          <h2 className="font-medium">Transcription Workspace</h2>
          {midiData && <span className="muted text-xs">{midiData.notes.length} note(s)</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              sourceAsset &&
              onRunWorkflow('MIDI transcription', '/api/workflows/midi/transcribe', {
                source_asset_id: sourceAsset.id,
              })
            }
            disabled={!sourceAsset || Boolean(running)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Music className="h-4 w-4" />
            MIDI
          </button>
          <button
            type="button"
            onClick={() =>
              noteEventsAsset &&
              onRunWorkflow('MusicXML conversion', '/api/workflows/midi/convert-musicxml', {
                note_events_asset_id: noteEventsAsset.id,
                title: song?.title,
              })
            }
            disabled={!noteEventsAsset || Boolean(running)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileMusic className="h-4 w-4" />
            MusicXML
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 pt-3">
        <div className="flex gap-1 overflow-x-auto">
          {viewConfig.map((view) => {
            const Icon = view.icon;
            const active = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm ${
                  active
                    ? 'border-[var(--accent)] text-[var(--accent-strong)]'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {activeView === 'waveform' && (
          <WaveformPanel waveform={waveform} error={waveformError} selectedSection={selectedSection} />
        )}
        {activeView === 'piano' && (
          <PianoPanel
            midiData={midiData}
            error={midiError}
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
          />
        )}
        {activeView === 'sheet' && (
          <ArtifactPanel
            title="Sheet Music"
            asset={musicXmlAsset}
            fallback="No MusicXML score is available yet."
            onOpenAsset={onOpenAsset}
          />
        )}
        {activeView === 'tab' && (
          <ArtifactPanel
            title="Tablature"
            asset={tabAsset}
            fallback="No tab artifact is available yet."
            onOpenAsset={onOpenAsset}
          />
        )}
        {activeView === 'assistant' && (
          <TranscriptionAssistantPanel
            sessions={sessions}
            selectedSection={selectedSection}
            input={assistantInput}
            error={assistantError}
            message={assistantMessage}
            busy={assistantBusy}
            onInputChange={setAssistantInput}
            onCreateSession={() => void createEditSession()}
            onApply={(session) => void applySession(session)}
            onReject={(session) => void rejectSession(session)}
          />
        )}
      </div>
    </section>
  );
}

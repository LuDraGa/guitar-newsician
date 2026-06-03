import { useCallback, useEffect, useMemo, useState } from 'react';

import { parseMidiUrl, type MidiParsedData } from '@/lib/music/midi';
import { extractDetailedWaveform, type DetailedWaveformData } from '@/lib/music/waveform';
import type { AssetRow, MidiEditSessionRow, SongRow } from '@/types/werecode';
import { jsonArray } from './TranscriptionAssistantPanel';
import { fetchJson, signDownload } from './studio-utils';

export type TranscriptionView = 'waveform' | 'piano' | 'sheet' | 'tab';

export function useTranscriptionWorkspace({
  song,
  assets,
  audioUrl,
}: {
  song: SongRow | null;
  assets: AssetRow[];
  audioUrl: string | null;
}) {
  const [activeView, setActiveView] = useState<TranscriptionView>('waveform');
  const [midiData, setMidiData] = useState<MidiParsedData | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<DetailedWaveformData | null>(null);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ start: number; end: number } | null>(null);
  const [sessions, setSessions] = useState<MidiEditSessionRow[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  const latestAssetsByKind = useMemo(() => {
    const map = new Map<string, AssetRow>();
    for (const asset of assets) {
      if (!map.has(asset.kind)) {
        map.set(asset.kind, asset);
      }
    }
    return map;
  }, [assets]);

  const midiAsset = latestAssetsByKind.get('midi');
  const noteEventsAsset = latestAssetsByKind.get('note_events');
  const musicXmlAsset = latestAssetsByKind.get('musicxml');
  const tabAsset = latestAssetsByKind.get('tab_musicxml');

  const loadSessions = useCallback(async () => {
    if (!song) {
      setSessions([]);
      return;
    }

    const payload = await fetchJson<{ sessions: MidiEditSessionRow[] }>(`/api/songs/${song.id}/midi-edits`);
    setSessions(payload.sessions);
  }, [song]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions().catch((error) => {
        setAssistantError(error instanceof Error ? error.message : 'Could not load MIDI edit sessions');
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  useEffect(() => {
    let cancelled = false;

    async function loadMidi() {
      setMidiError(null);
      setMidiData(null);

      if (!midiAsset) {
        return;
      }

      try {
        const signedUrl = await signDownload(midiAsset);
        if (cancelled) {
          return;
        }

        const parsed = await parseMidiUrl(signedUrl);
        if (!cancelled) {
          setMidiData(parsed);
        }
      } catch (error) {
        if (!cancelled) {
          setMidiError(error instanceof Error ? error.message : 'Could not load MIDI asset');
        }
      }
    }

    void loadMidi();

    return () => {
      cancelled = true;
    };
  }, [midiAsset]);

  useEffect(() => {
    let cancelled = false;

    async function loadWaveform() {
      setWaveform(null);
      setWaveformError(null);

      if (!audioUrl) {
        return;
      }

      try {
        const nextWaveform = await extractDetailedWaveform(audioUrl, 720);
        if (!cancelled) {
          setWaveform(nextWaveform);
        }
      } catch (error) {
        if (!cancelled) {
          setWaveformError(error instanceof Error ? error.message : 'Could not decode waveform');
        }
      }
    }

    void loadWaveform();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  async function createEditSession() {
    if (!song || !assistantInput.trim()) {
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    setAssistantMessage(null);

    try {
      const proposedChange = {
        type: 'assistant_review_request',
        description: assistantInput.trim(),
        section_start_sec: selectedSection?.start ?? null,
        section_end_sec: selectedSection?.end ?? null,
        source_midi_asset_id: midiAsset?.id ?? null,
      };
      const payload = await fetchJson<{ session: MidiEditSessionRow }>(`/api/songs/${song.id}/midi-edits`, {
        method: 'POST',
        body: JSON.stringify({
          source_midi_asset_id: midiAsset?.id ?? null,
          stem_name: 'midi',
          section_start_sec: selectedSection?.start ?? null,
          section_end_sec: selectedSection?.end ?? null,
          issue_description: assistantInput.trim(),
          proposed_changes: [proposedChange],
          verification: {
            source: 'next_transcription_workspace',
            summary: 'Assistant proposal captured for review and apply workflow.',
          },
        }),
      });

      setSessions((current) => [payload.session, ...current]);
      setAssistantInput('');
      setAssistantMessage('Assistant proposal saved');
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : 'Could not save assistant proposal');
    } finally {
      setAssistantBusy(false);
    }
  }

  async function applySession(session: MidiEditSessionRow) {
    if (!song) {
      return;
    }

    const proposedChanges = jsonArray(session.proposed_changes);
    if (proposedChanges.length === 0) {
      setAssistantError('Session has no proposed changes to apply');
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    setAssistantMessage(null);

    try {
      await fetchJson('/api/workflows/midi/edit/apply', {
        method: 'POST',
        body: JSON.stringify({
          song_id: song.id,
          session_id: session.id,
          source_midi_asset_id: session.source_midi_asset_id ?? midiAsset?.id ?? null,
          proposed_changes: proposedChanges,
          verification: {
            source: 'next_transcription_workspace',
            applied_session_id: session.id,
          },
        }),
      });
      setAssistantMessage('MIDI edit manifest applied');
      await loadSessions();
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : 'Could not apply assistant proposal');
    } finally {
      setAssistantBusy(false);
    }
  }

  async function rejectSession(session: MidiEditSessionRow) {
    if (!song) {
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    setAssistantMessage(null);

    try {
      const payload = await fetchJson<{ session: MidiEditSessionRow }>(`/api/songs/${song.id}/midi-edits/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          feedback: 'Rejected from Next transcription workspace',
        }),
      });
      setSessions((current) => current.map((item) => (item.id === payload.session.id ? payload.session : item)));
      setAssistantMessage('Assistant proposal rejected');
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : 'Could not reject assistant proposal');
    } finally {
      setAssistantBusy(false);
    }
  }

  return {
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
    midiAsset,
    noteEventsAsset,
    musicXmlAsset,
    tabAsset,
    createEditSession,
    applySession,
    rejectSession,
  };
}

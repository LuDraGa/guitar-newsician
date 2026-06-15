'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Hammer,
  KeyRound,
  ListTree,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { PillIcon, ReadinessChips } from '@/components/werecode/WereCodePrimitives';

/**
 * Maestro: the in-product guitar-learning coach (developer surface).
 *
 * Flag-gated by `isMaestroEnabled()` and unreachable on prod, mirroring Pipeline.
 * This wires the workbench to the local baseline agent through the Next
 * `/api/maestro/*` routes (which proxy `MAESTRO_AGENT_URL`): pick a song, build
 * or load its fact pack, ask evidence-backed questions, and inspect the fact
 * pack + reasoning trace behind every answer. See
 * docs/execution_docs/2026-06-14_maestro-baseline-build.md.
 */

type SongOption = {
  id: string;
  title: string;
  artist: string | null;
  has_stems: boolean;
  has_midi: boolean;
  has_analysis: boolean;
};

type FactPack = Record<string, unknown>;

type ChatTrace = Record<string, unknown> | null;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  trace?: ChatTrace;
};

const SUGGESTED_PROMPTS = [
  'What key should I trust?',
  'What sections are detected?',
  'Transpose to G',
];

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function MaestroClient() {
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [loadingSongs, setLoadingSongs] = useState(true);

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const [factPack, setFactPack] = useState<FactPack | null>(null);
  const [factPackBusy, setFactPackBusy] = useState<'idle' | 'building' | 'loading'>('idle');
  const [factPackError, setFactPackError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Try to load a song's existing fact pack. A 404/409 just means "not built
  // yet" — the build button covers that case.
  const loadLatestPack = useCallback(async (songId: string) => {
    setFactPack(null);
    setFactPackError(null);
    setFactPackBusy('loading');
    try {
      const response = await fetch(`/api/maestro/fact-pack/${songId}`, { cache: 'no-store' });
      if (response.status === 404 || response.status === 409) {
        return; // not built yet — leave the build prompt
      }
      if (!response.ok) throw new Error(await readError(response, 'Could not load the fact pack'));
      const body = await response.json();
      setFactPack(body.factPack ?? null);
    } catch (error) {
      setFactPackError(error instanceof Error ? error.message : 'Could not load the fact pack');
    } finally {
      setFactPackBusy('idle');
    }
  }, []);

  // Switching songs starts a fresh conversation and loads that song's fact pack.
  // Driven from event handlers (not a [selectedSongId] effect) so we never reset
  // state synchronously inside an effect body.
  const selectSong = useCallback(
    (songId: string) => {
      setSelectedSongId(songId);
      setMessages([]);
      setChatError(null);
      setInput('');
      void loadLatestPack(songId);
    },
    [loadLatestPack]
  );

  // Load the developer's library, narrowed to songs that carry the mix analysis
  // the fact pack is built from (no analysis ⇒ nothing for Maestro to read), and
  // auto-select the first one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/library?includeJobs=false', { cache: 'no-store' });
        if (!response.ok) throw new Error(await readError(response, 'Could not load library'));
        const body = await response.json();
        if (cancelled) return;
        const ready: SongOption[] = (body.songs ?? []).filter((song: SongOption) => song.has_analysis);
        setSongs(ready);
        if (ready[0]) selectSong(ready[0].id);
      } catch (error) {
        if (!cancelled) setSongsError(error instanceof Error ? error.message : 'Could not load library');
      } finally {
        if (!cancelled) setLoadingSongs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectSong]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatBusy]);

  async function buildPack() {
    if (!selectedSongId) return;
    setFactPackError(null);
    setFactPackBusy('building');
    try {
      const response = await fetch('/api/maestro/fact-pack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ songId: selectedSongId }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not build the fact pack'));
      const body = await response.json();
      setFactPack(body.factPack ?? null);
    } catch (error) {
      setFactPackError(error instanceof Error ? error.message : 'Could not build the fact pack');
    } finally {
      setFactPackBusy('idle');
    }
  }

  async function send(messageText: string) {
    const text = messageText.trim();
    if (!text || !selectedSongId || chatBusy) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setChatError(null);
    setChatBusy(true);
    try {
      const response = await fetch('/api/maestro/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ songId: selectedSongId, message: text, history }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not reach Maestro'));
      const body = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: body.content ?? '(no answer)', trace: body.raw ?? null },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not reach Maestro');
    } finally {
      setChatBusy(false);
    }
  }

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === selectedSongId) ?? null,
    [songs, selectedSongId]
  );
  const summary = useMemo(() => summarizeFactPack(factPack), [factPack]);
  const hasPack = Boolean(factPack);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8">
        <span className="pill ghost sm">
          <PillIcon>
            <Sparkles className="h-3.5 w-3.5" />
          </PillIcon>
          Developer surface
        </span>
        <h1 className="display mt-4 text-balance text-[clamp(24px,4vw,34px)]">Maestro coach workbench</h1>
        <p className="mt-2 max-w-prose text-[14px] leading-6 text-[var(--muted)]">
          Pick a song with trusted analysis, build its fact pack, then ask Maestro. Every answer is
          evidence-backed and the reasoning trace is inspectable below it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left rail: song picker + fact pack */}
        <aside className="flex flex-col gap-6">
          <section className="surface p-4">
            <h2 className="display text-[13px] uppercase tracking-wide text-[var(--muted)]">Song</h2>
            {loadingSongs ? (
              <p className="mt-3 text-[13px] text-[var(--muted)]">Loading library…</p>
            ) : songsError ? (
              <p className="mt-3 text-[13px] text-[var(--danger)]">{songsError}</p>
            ) : songs.length === 0 ? (
              <p className="mt-3 text-[13px] leading-5 text-[var(--muted)]">
                No analysis-ready songs. Seed one with{' '}
                <code className="rounded bg-[var(--card)] px-1 py-0.5 text-[12px]">
                  node --env-file=.env scripts/seed-maestro-babyslakh.mjs
                </code>
                .
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {songs.map((song) => {
                  const active = song.id === selectedSongId;
                  return (
                    <li key={song.id}>
                      <button
                        type="button"
                        onClick={() => selectSong(song.id)}
                        className="surface w-full p-3 text-left transition"
                        style={
                          active
                            ? { boxShadow: 'inset 0 0 0 1.5px var(--accent)' }
                            : undefined
                        }
                      >
                        <p className="display text-[14px] leading-5">{song.title}</p>
                        {song.artist && (
                          <p className="mt-0.5 text-[12px] text-[var(--muted)]">{song.artist}</p>
                        )}
                        <div className="mt-2">
                          <ReadinessChips
                            items={[
                              { label: 'Stems', ready: song.has_stems },
                              { label: 'MIDI', ready: song.has_midi },
                              { label: 'Analysis', ready: song.has_analysis },
                            ]}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="display text-[13px] uppercase tracking-wide text-[var(--muted)]">Fact pack</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="pill ghost sm"
                  disabled={!selectedSongId || factPackBusy !== 'idle'}
                  onClick={() => selectedSongId && loadLatestPack(selectedSongId)}
                  title="Load the latest persisted fact pack"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${factPackBusy === 'loading' ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  className="pill sm"
                  disabled={!selectedSongId || factPackBusy !== 'idle'}
                  onClick={buildPack}
                >
                  <Hammer className="h-3.5 w-3.5" />
                  {factPackBusy === 'building' ? 'Building…' : hasPack ? 'Rebuild' : 'Build'}
                </button>
              </div>
            </div>

            {factPackError && (
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-[var(--danger)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {factPackError}
              </p>
            )}

            {summary ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                <SummaryRow label="Teaching key" value={summary.teachingKey} icon />
                <SummaryRow label="Detected key" value={summary.detectedKey} />
                <SummaryRow label="Tempo" value={summary.tempo} />
                <SummaryRow label="Sections" value={summary.sections} />
                <SummaryRow label="Stems" value={summary.stems} />
                <SummaryRow label="Confidence" value={summary.confidence} />
                {summary.keyConflict && (
                  <p className="col-span-2 mt-1 flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
                    <AlertTriangle className="h-3 w-3" />
                    Teaching and detected keys disagree.
                  </p>
                )}
              </dl>
            ) : (
              !factPackError && (
                <p className="mt-3 text-[13px] leading-5 text-[var(--muted)]">
                  {factPackBusy === 'loading'
                    ? 'Loading…'
                    : 'No fact pack yet. Build one to ground the coach.'}
                </p>
              )
            )}

            {factPack && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">
                  Inspect fact pack JSON
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-[var(--card)] p-3 text-[11px] leading-4">
                  {JSON.stringify(factPack, null, 2)}
                </pre>
              </details>
            )}
          </section>
        </aside>

        {/* Right: chat */}
        <section className="surface flex min-h-[60vh] flex-col p-0">
          <div className="flex items-center gap-2 border-b border-[var(--hair)] px-5 py-3">
            <PillIcon>
              <KeyRound className="h-3.5 w-3.5" />
            </PillIcon>
            <p className="display text-[14px]">
              {selectedSong ? selectedSong.title : 'Maestro'}
            </p>
          </div>

          <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && !chatBusy && (
              <div className="text-[13px] leading-6 text-[var(--muted)]">
                <p className="flex items-center gap-1.5">
                  <ListTree className="h-3.5 w-3.5" />
                  Ask about the key, sections, chords, tempo, or parts. Try:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chip"
                      disabled={!hasPack}
                      onClick={() => send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {!hasPack && (
                  <p className="mt-3 text-[12px]">Build the fact pack first to enable questions.</p>
                )}
              </div>
            )}

            {messages.map((message, index) => (
              <ChatBubble key={index} message={message} />
            ))}

            {chatBusy && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Maestro is thinking…
              </div>
            )}

            {chatError && (
              <p className="flex items-start gap-2 text-[13px] leading-5 text-[var(--danger)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {chatError}
              </p>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-[var(--hair)] px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={hasPack ? 'Ask Maestro about this song…' : 'Build the fact pack to begin'}
              disabled={!hasPack || chatBusy}
              className="flex-1 rounded-full border border-[var(--hair)] bg-[var(--paper)] px-4 py-2.5 text-[14px] outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
            <button type="submit" className="pill" disabled={!hasPack || chatBusy || !input.trim()}>
              <Send className="h-4 w-4" />
              Ask
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
        {icon && <KeyRound className="h-3 w-3" />}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--ink)] px-4 py-2.5 text-[14px] leading-6 text-[var(--paper)]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div
        className="markdown max-w-[92%] text-[14px] leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--card)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h1]:mt-2 [&_h1]:text-[16px] [&_h2]:mt-2 [&_h2]:text-[15px] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--card)] [&_pre]:p-3 [&_pre]:text-[12px] [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--hair)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--hair)] [&_th]:bg-[var(--card)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      {message.trace && (
        <details className="max-w-[92%]">
          <summary className="cursor-pointer text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">
            {traceLabel(message.trace)}
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-[var(--card)] p-3 text-[11px] leading-4">
            {JSON.stringify(message.trace, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function traceLabel(trace: ChatTrace): string {
  if (!trace || typeof trace !== 'object') return 'Inspect trace';
  const usage = (trace as { usage?: Record<string, unknown> }).usage;
  const elapsed = (trace as { elapsed_ms?: number }).elapsed_ms;
  const parts: string[] = ['Inspect trace'];
  if (usage && typeof usage === 'object') {
    const tokens = (usage as { total_tokens?: number }).total_tokens;
    const cost = (usage as { total_cost_usd?: number; cost_usd?: number }).total_cost_usd ?? (usage as { cost_usd?: number }).cost_usd;
    if (typeof tokens === 'number') parts.push(`${tokens.toLocaleString()} tok`);
    if (typeof cost === 'number') parts.push(`$${cost.toFixed(4)}`);
  }
  if (typeof elapsed === 'number') parts.push(`${(elapsed / 1000).toFixed(1)}s`);
  return parts.join(' · ');
}

type FactPackSummary = {
  teachingKey: string;
  detectedKey: string;
  tempo: string;
  sections: string;
  stems: string;
  confidence: string;
  keyConflict: boolean;
};

function summarizeFactPack(pack: FactPack | null): FactPackSummary | null {
  if (!pack) return null;
  const key = asRecord(pack.key);
  const tempo = asRecord(pack.tempo);
  const confidence = asRecord(pack.confidence);
  const song = asRecord(pack.song);
  const sections = Array.isArray(pack.sections) ? pack.sections : [];
  const stems = Array.isArray(song?.stems) ? (song!.stems as unknown[]) : [];

  const teaching = asRecord(key?.teaching_key);
  const detected = asRecord(key?.detected_key);
  const bpm = tempo?.bpm;

  return {
    teachingKey: stringValue(teaching?.label) ?? '—',
    detectedKey: stringValue(detected?.label) ?? '—',
    tempo: typeof bpm === 'number' ? `${Math.round(bpm)} bpm` : '—',
    sections: String(sections.length),
    stems: String(stems.length),
    confidence: stringValue(confidence?.overall) ?? '—',
    keyConflict: key?.key_conflict === true,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

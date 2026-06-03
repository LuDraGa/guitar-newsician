'use client';

import { Bot, Check, Loader2, Send, X } from 'lucide-react';

import { formatTime } from '@/lib/music/lrc';
import type { Json, MidiEditSessionRow } from '@/types/werecode';
import { formatDate, statusClass } from './studio-utils';

export function TranscriptionAssistantPanel({
  sessions,
  selectedSection,
  input,
  error,
  message,
  busy,
  layout = 'split',
  onInputChange,
  onCreateSession,
  onApply,
  onReject,
}: {
  sessions: MidiEditSessionRow[];
  selectedSection: { start: number; end: number } | null;
  input: string;
  error: string | null;
  message: string | null;
  busy: boolean;
  layout?: 'split' | 'stacked';
  onInputChange: (value: string) => void;
  onCreateSession: () => void;
  onApply: (session: MidiEditSessionRow) => void;
  onReject: (session: MidiEditSessionRow) => void;
}) {
  return (
    <div className={layout === 'stacked' ? 'grid gap-4' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'}>
      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="font-medium text-white">AI Assistant</h3>
          </div>
          {selectedSection && (
            <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-xs text-slate-300">
              {formatTime(selectedSection.start)}-{formatTime(selectedSection.end)}
            </span>
          )}
        </div>
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          className="min-h-32 w-full resize-y rounded-md border border-white/10 bg-[#0d121b] p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent)]"
          placeholder="Describe the MIDI issue or edit request"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="muted text-xs">
            {selectedSection ? 'Proposal will be linked to the selected MIDI section.' : 'Click a MIDI note to select a section.'}
          </div>
          <button
            type="button"
            onClick={onCreateSession}
            disabled={busy || !input.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-slate-950 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save Proposal
          </button>
        </div>
        {message && <div className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>}
        {error && <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
      </div>

      <div className="rounded-md border border-white/10 bg-black/20">
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <h3 className="text-sm font-medium text-white">Edit Sessions</h3>
          <span className="muted text-xs">{sessions.length}</span>
        </div>
        <div className="max-h-80 overflow-auto">
          {sessions.map((session) => (
            <div key={session.id} className="border-b border-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{session.issue_description ?? 'MIDI edit proposal'}</div>
                  <div className="muted mt-1 text-xs">{formatDate(session.created_at)}</div>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs ${statusClass(session.status)}`}>{session.status}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onApply(session)}
                  disabled={busy || session.status === 'applied' || jsonArray(session.proposed_changes).length === 0}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => onReject(session)}
                  disabled={busy || session.status === 'rejected'}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <div className="muted p-3 text-sm">No MIDI edit sessions yet.</div>}
        </div>
      </div>
    </div>
  );
}

export function jsonArray(value: Json): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

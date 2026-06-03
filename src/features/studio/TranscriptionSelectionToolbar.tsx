'use client';

import { X } from 'lucide-react';

import { formatTimeDetailed } from '@/lib/music/lrc';

export function TranscriptionSelectionToolbar({
  selectedSection,
  onClear,
}: {
  selectedSection: { start: number; end: number } | null;
  onClear: () => void;
}) {
  if (!selectedSection) {
    return null;
  }

  const duration = Math.max(0, selectedSection.end - selectedSection.start);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-slate-200">
        <span className="muted text-xs uppercase tracking-wide">Selected Range</span>
        <span className="font-mono text-xs">
          {formatTimeDetailed(selectedSection.start)} - {formatTimeDetailed(selectedSection.end)}
        </span>
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-xs text-slate-300">
          {duration.toFixed(2)}s
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-slate-200 hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}

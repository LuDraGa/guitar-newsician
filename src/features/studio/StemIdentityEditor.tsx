'use client';

import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { SUGGESTED_STEM_TAGS, type StemInfo } from '@/lib/music/stem-metadata';

/**
 * Curate one stem's identity — its label and its tags.
 *
 * Tags are the finer-than-role axis ("lead", "rhythm", "clean") that Maestro's
 * Section × Role briefs read to tell one guitar from another. Left generic, three
 * stems all called "Guitar" are twins the coach can only hedge about; named here,
 * they become parts it can actually coach. Saving retires Maestro's cached
 * understanding of the song, so the next brief is computed on the corrected roster.
 */
export function StemIdentityEditor({
  info,
  saving,
  onSave,
  onCancel,
}: {
  info: StemInfo;
  saving: boolean;
  onSave: (next: { label: string; tags: string[] }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(info.label);
  const [tags, setTags] = useState<string[]>(info.tags);
  const [draft, setDraft] = useState('');

  // The role is always the first tag on read (`getStemInfo`), and it is not
  // curatable here — it lives in the asset's `kind`. Show it, don't offer it.
  const suggestions = SUGGESTED_STEM_TAGS[info.role].filter((tag) => !hasTag(tags, tag));
  const curated = tags.filter((tag) => tag.toLowerCase() !== info.role);

  function toggleTag(tag: string) {
    setTags((current) => (hasTag(current, tag) ? current.filter((item) => item.toLowerCase() !== tag.toLowerCase()) : [...current, tag]));
  }

  function addDraft() {
    const next = draft.trim();
    if (!next || hasTag(tags, next) || tags.length >= 8) {
      setDraft('');
      return;
    }
    setTags((current) => [...current, next]);
    setDraft('');
  }

  const trimmedLabel = label.trim();

  return (
    <div className="grid gap-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)]">
      <label className="grid gap-1">
        <span className="mono text-[9px] uppercase tracking-wide text-[var(--faint)]">Part name</span>
        <input
          autoFocus
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel();
          }}
          placeholder="Lead Guitar"
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 text-[13px] font-bold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        />
      </label>

      <div className="grid gap-1.5">
        <span className="mono text-[9px] uppercase tracking-wide text-[var(--faint)]">
          Tags — how Maestro tells this part from its neighbours
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip" title="The role comes from the stem itself and can't be edited here">
            {info.role}
          </span>
          {curated.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              title={`Remove "${tag}"`}
              // Unlayered `button { background: none }` beats Tailwind bg utilities
              // in this repo — set the fill inline (see DESIGN.md / globals.css).
              style={{ background: 'var(--accent-soft)' }}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[12px] font-semibold text-[var(--accent-ink)]"
            >
              {tag}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>

        {suggestions.length > 0 && tags.length < 8 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{ background: 'transparent' }}
                className="rounded-full border border-dashed border-[var(--line)] px-2 py-0.5 text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            maxLength={24}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addDraft();
              }
              if (event.key === 'Escape') onCancel();
            }}
            placeholder="Something else…"
            disabled={tags.length >= 8}
            className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-[12px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim() || tags.length >= 8}
            aria-label="Add tag"
            style={{ background: 'transparent' }}
            className="rounded-full border border-[var(--line)] p-1 text-[var(--muted)] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] leading-tight text-[var(--faint)]">Maestro re-studies the song after a change.</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{ background: 'transparent' }}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-semibold text-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ label: trimmedLabel || info.label, tags })}
            disabled={saving}
            style={{ background: 'var(--ink)' }}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold text-[var(--paper)] disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function hasTag(tags: string[], tag: string) {
  return tags.some((item) => item.toLowerCase() === tag.toLowerCase());
}

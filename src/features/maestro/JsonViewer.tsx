'use client';

import { useState } from 'react';
import { ChevronRight, Copy as CopyIcon } from 'lucide-react';

/**
 * Collapsible JSON tree for the Maestro runtime/tool drawer.
 *
 * Replaces a raw `<pre>` dump: every object/array folds, long arrays page in,
 * and long string values wrap by default. Deliberately dependency-free
 * (React 19) and styled with the bench tokens so it sits inside the slide-over
 * card.
 */

const INITIAL_OPEN_DEPTH = 2;
const CHILD_PAGE = 50;
const STRING_PREVIEW = 180;
const STRING_PAGE = 240;

export function JsonViewer({ data }: { data: unknown }) {
  const [forceOpen, setForceOpen] = useState<boolean | null>(null);
  const [seq, setSeq] = useState(0);
  const [copied, setCopied] = useState(false);

  function copyAll() {
    try {
      void navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable; ignore */
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="chip"
          onClick={() => {
            setForceOpen(true);
            setSeq((s) => s + 1);
          }}
        >
          Expand all
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setForceOpen(false);
            setSeq((s) => s + 1);
          }}
        >
          Collapse all
        </button>
        <button type="button" className="chip" onClick={copyAll}>
          <CopyIcon className="h-3 w-3" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-[10px] bg-[var(--paper)] p-3 font-mono text-[11px] leading-5 text-[var(--ink-2)]">
        <JsonNode key={seq} name={null} value={data} depth={0} forceOpen={forceOpen} />
      </div>
    </div>
  );
}

function JsonNode({
  name,
  value,
  depth,
  forceOpen,
}: {
  name: string | null;
  value: unknown;
  depth: number;
  forceOpen: boolean | null;
}) {
  const isArray = Array.isArray(value);
  const isObject = !isArray && value !== null && typeof value === 'object';
  const [open, setOpen] = useState(forceOpen ?? depth < INITIAL_OPEN_DEPTH);

  if (!isArray && !isObject) {
    return (
      <div className="flex min-w-0 gap-1.5">
        {name !== null && <JsonName name={name} />}
        <JsonLeaf value={value} />
      </div>
    );
  }

  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);

  if (entries.length === 0) {
    return (
      <div className="flex min-w-0 gap-1.5">
        {name !== null && <JsonName name={name} />}
        <span className="text-[var(--faint)]">{isArray ? '[]' : '{}'}</span>
      </div>
    );
  }

  const bracket = isArray ? `[${entries.length}]` : `{${entries.length}}`;
  const label = name ?? 'root';

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1 text-left hover:text-[var(--ink)]"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {name !== null && <JsonName name={name} />}
        <span className="shrink-0 text-[var(--faint)]">
          {bracket}
          {open ? '' : ' ...'}
        </span>
      </button>
      {open && (
        <div className="ml-[0.34rem] border-l border-[var(--line-2)] pl-3">
          <JsonChildren entries={entries} depth={depth} forceOpen={forceOpen} />
        </div>
      )}
    </div>
  );
}

function JsonChildren({
  entries,
  depth,
  forceOpen,
}: {
  entries: [string, unknown][];
  depth: number;
  forceOpen: boolean | null;
}) {
  const [limit, setLimit] = useState(CHILD_PAGE);
  const shown = entries.length > limit ? entries.slice(0, limit) : entries;
  const hidden = entries.length - shown.length;
  const canPage = entries.length > CHILD_PAGE;

  return (
    <>
      {shown.map(([key, item]) => (
        <JsonNode key={key} name={key} value={item} depth={depth + 1} forceOpen={forceOpen} />
      ))}
      {hidden > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-tight">
          <button
            type="button"
            onClick={() => setLimit((l) => Math.min(entries.length, l + CHILD_PAGE))}
            className="rounded-full bg-[var(--card-2)] px-2 py-1 font-bold text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-[var(--accent-soft)]"
          >
            Show {Math.min(CHILD_PAGE, hidden)} more
          </button>
          <button
            type="button"
            onClick={() => setLimit(entries.length)}
            className="rounded-full px-2 py-1 font-bold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Show all
          </button>
          {limit > CHILD_PAGE && (
            <button
              type="button"
              onClick={() => setLimit(CHILD_PAGE)}
              className="rounded-full px-2 py-1 font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Show less
            </button>
          )}
          <span className="text-[var(--faint)]">{hidden} hidden</span>
        </div>
      )}
      {canPage && hidden === 0 && (
        <button
          type="button"
          onClick={() => setLimit(CHILD_PAGE)}
          className="mt-1 rounded-full px-2 py-1 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Show less
        </button>
      )}
    </>
  );
}

function JsonLeaf({ value }: { value: unknown }) {
  if (value === null) return <span className="text-[var(--muted)]">null</span>;
  if (value === undefined) return <span className="text-[var(--muted)]">undefined</span>;
  const type = typeof value;
  if (type === 'string') return <JsonString value={value as string} />;
  if (type === 'number' || type === 'bigint') return <span className="text-[var(--ink)]">{String(value)}</span>;
  if (type === 'boolean') return <span className="text-[var(--warn)]">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function JsonName({ name }: { name: string }) {
  const isIndex = /^\d+$/.test(name);
  return (
    <span className={`shrink-0 ${isIndex ? 'text-[var(--faint)]' : 'text-[var(--muted)]'}`}>
      {isIndex ? name : JSON.stringify(name)}:
    </span>
  );
}

function JsonString({ value }: { value: string }) {
  const [limit, setLimit] = useState(STRING_PREVIEW);
  const encoded = JSON.stringify(value);
  const isLong = encoded.length > STRING_PREVIEW;
  const effectiveLimit = isLong ? Math.min(limit, encoded.length) : encoded.length;
  const truncated = isLong && effectiveLimit < encoded.length;
  const shown = truncated ? `${encoded.slice(0, effectiveLimit)}...` : encoded;
  const remaining = encoded.length - effectiveLimit;

  return (
    <span className="min-w-0">
      <span className="whitespace-pre-wrap break-words text-[var(--accent-ink)]">{shown}</span>
      {isLong && (
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-tight">
          {truncated ? (
            <>
              <button
                type="button"
                onClick={() => setLimit((l) => Math.min(encoded.length, l + STRING_PAGE))}
                className="rounded-full bg-[var(--card-2)] px-2 py-1 font-bold text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-[var(--accent-soft)]"
              >
                Show {Math.min(STRING_PAGE, remaining)} more
              </button>
              <button
                type="button"
                onClick={() => setLimit(encoded.length)}
                className="rounded-full px-2 py-1 font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Show all
              </button>
              {effectiveLimit > STRING_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setLimit(STRING_PREVIEW)}
                  className="rounded-full px-2 py-1 font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Show less
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLimit(STRING_PREVIEW)}
              className="rounded-full px-2 py-1 font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Show less
            </button>
          )}
          <span className="text-[var(--faint)]">{encoded.length.toLocaleString()} chars</span>
        </span>
      )}
    </span>
  );
}

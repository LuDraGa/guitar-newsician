import type { CSSProperties, ReactNode } from 'react';

export function hueFromString(value: string | null | undefined) {
  const input = value || 'werecode';
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 360;
  }
  return hash;
}

export function CoverArt({
  id,
  hue,
  size = 56,
  className = '',
}: {
  id?: string | null;
  hue?: number;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`wc-cover ${className}`}
      style={
        {
          '--cover-hue': hue ?? hueFromString(id),
          width: size,
          height: size,
        } as CSSProperties
      }
    />
  );
}

const statusMeta: Record<string, { label: string; color: string; pulse?: boolean; chip: string }> = {
  ready: { label: 'Ready', color: 'var(--live)', chip: 'live' },
  processing: { label: 'Processing', color: 'var(--accent)', pulse: true, chip: 'accent' },
  importing: { label: 'Importing', color: 'var(--accent)', pulse: true, chip: 'accent' },
  queued: { label: 'Queued', color: 'var(--faint)', chip: '' },
  failed: { label: 'Failed', color: 'var(--danger)', chip: 'danger' },
  cancelled: { label: 'Cancelled', color: 'var(--faint)', chip: '' },
  archived: { label: 'Archived', color: 'var(--faint)', chip: '' },
  draft: { label: 'Draft', color: 'var(--faint)', chip: '' },
};

export function statusLabel(status: string | null | undefined) {
  return statusMeta[status ?? '']?.label ?? (status ? titleCase(status) : 'Unknown');
}

export function statusChipClass(status: string | null | undefined) {
  const chip = statusMeta[status ?? '']?.chip;
  return `chip ${chip ?? ''}`.trim();
}

export function StatusDot({ status, label }: { status: string | null | undefined; label?: string }) {
  const meta = statusMeta[status ?? ''] ?? { label: statusLabel(status), color: 'var(--faint)' };
  return (
    <span className="wc-status">
      <span
        className={`wc-status-dot ${meta.pulse ? 'pulse' : ''}`}
        style={{ '--status-color': meta.color } as CSSProperties}
      />
      {label ?? meta.label}
    </span>
  );
}

export function ReadinessChips({ items }: { items: { label: string; ready: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item.label} className={item.ready ? 'chip live' : 'chip'}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function PillIcon({ children }: { children: ReactNode }) {
  return <span className="dot">{children}</span>;
}

function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

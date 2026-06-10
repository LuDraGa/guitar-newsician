import type { CSSProperties } from 'react';

/* Stroke icons (lucide-flavored) used across the marketing landing.
   Kept self-contained — the landing draws from the same single icon
   vocabulary the Claude-designed source shipped with, so the visual
   match to the design captures is exact. */
export const ICONS = {
  play: 'M6 4.5l13 7.5-13 7.5z',
  pause: ['M9 5v14', 'M15 5v14'],
  mic: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  guitar: ['M11 13a3 3 0 1 1-3-3', 'M11 10l8-8', 'M16 3l5 5', 'M14 5l5 5'],
  sparkles: ['M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z', 'M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9z'],
  scissors: ['M6 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M6 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M8 9.5L20 5', 'M8 14.5L20 19', 'M11 12l3 1.2'],
  type: ['M5 6h14', 'M12 6v13', 'M9 19h6'],
  sheet: ['M4 5h16v14H4z', 'M4 9h16', 'M4 13h16', 'M4 17h16'],
  gauge: ['M12 13a9 9 0 1 0-9-9', 'M12 13l4-4', 'M3 13a9 9 0 0 0 18 0'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-3.5-3.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: 'M5 12.5l4.5 4.5L19 7',
  x: ['M6 6l12 12', 'M18 6L6 18'],
  arrowR: ['M5 12h14', 'M13 5l7 7-7 7'],
  arrowDown: ['M12 5v14', 'M5 12l7 7 7-7'],
  chevD: 'M6 9l6 6 6-6',
  send: ['M5 12l15-7-7 15-2-6z'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  volume: ['M4 9v6h4l5 4V5L8 9z', 'M17 8a5 5 0 0 1 0 8'],
  loop: ['M4 9a5 5 0 0 1 5-5h7', 'M20 15a5 5 0 0 1-5 5H8', 'M16 1l3 3-3 3', 'M8 17l-3 3 3 3'],
  wand: ['M4 20l10-10', 'M14 6l1.5-1.5', 'M18 4l.6 1.8L20.4 6l-1.8.6L18 8l-.6-1.6L15.6 6l1.8-.6z'],
  back: ['M10 19l-7-7 7-7', 'M3 12h18'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  className = '',
  style,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  const raw: string | readonly string[] = ICONS[name];
  const paths = typeof raw === 'string' ? [raw] : raw;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

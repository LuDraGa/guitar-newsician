'use client';

/* ============================================================
   StudioGlimpse — a faithful mini-mock of the in-product Studio,
   reused as hero imagery. The transport ticks (timecode + playhead
   looping over a 15s passage) when motion is allowed, so the bench
   reads as live rather than a screenshot. Self-contained.
   ============================================================ */
import { useMemo, useRef } from 'react';

import { Icon } from './MarketingIcon';
import { CoverArt, waveBars } from './MarketingPrimitives';
import { gsap, useGSAP } from './gsap';

const SONG_LENGTH = 289; // 4:49
const LOOP_FROM = 88; // 1:28
const LOOP_TO = 103; // 1:43 — the looped passage the chip points at

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniStem({
  name,
  color,
  level,
  on = true,
}: {
  name: string;
  color: string;
  level: number;
  on?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 13,
          fontWeight: 600,
          color: on ? 'var(--ink)' : 'var(--faint)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} /> {name}
      </span>
      <span style={{ position: 'relative', height: 4, borderRadius: 99, background: 'var(--hair)' }}>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${level}%`,
            borderRadius: 99,
            background: on ? color : 'var(--faint)',
            opacity: on ? 1 : 0.4,
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: `${level}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 13,
            height: 13,
            borderRadius: 99,
            background: 'var(--ink)',
            boxShadow: '0 1px 4px oklch(0.2 0.01 60 / 0.3)',
          }}
        />
      </span>
      <span style={{ display: 'flex', gap: 4 }}>
        {['M', 'S'].map((x) => (
          <span
            key={x}
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              display: 'grid',
              placeItems: 'center',
              fontSize: 10.5,
              fontWeight: 700,
              background: x === 'S' && on ? 'var(--live-soft)' : 'var(--card-2)',
              color: x === 'S' && on ? 'var(--live-ink)' : 'var(--faint)',
              boxShadow: 'inset 0 0 0 1px var(--line-2)',
            }}
          >
            {x}
          </span>
        ))}
      </span>
    </div>
  );
}

export function StudioGlimpse({ compact = false }: { compact?: boolean }) {
  const sections = ['Intro', 'Verse 1', 'Pre', 'Chorus', 'Verse 2', 'Bridge', 'Outro'];
  const active = 1;
  const bars = useMemo(() => waveBars(42, compact ? 56 : 76), [compact]);
  const scope = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const clock = { t: LOOP_FROM };
        gsap.to(clock, {
          t: LOOP_TO,
          duration: LOOP_TO - LOOP_FROM,
          ease: 'none',
          repeat: -1,
          onUpdate: () => {
            if (timeRef.current) timeRef.current.textContent = formatTime(clock.t);
            if (headRef.current) headRef.current.style.left = `${((clock.t / SONG_LENGTH) * 100).toFixed(3)}%`;
          },
        });
      });
    },
    { scope },
  );

  return (
    <div
      ref={scope}
      className="surface"
      style={{ padding: compact ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)' }}
    >
      {/* song header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <CoverArt hue={55} size={46} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="display" style={{ fontSize: 19, lineHeight: 1 }}>
            Iris
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>Goo Goo Dolls · 1998</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {(
            [
              ['Key', 'B♭'],
              ['Tempo', '100'],
              ['Capo', '3'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'right' }}>
              <div className="label" style={{ fontSize: 8.5 }}>
                {k}
              </div>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, marginTop: 1 }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* stems */}
      <div className="surface-flat" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="label" style={{ fontSize: 9.5 }}>
            Stems
          </span>
          <span className="chip live" style={{ height: 21, fontSize: 10.5 }}>
            4 ready
          </span>
        </div>
        <MiniStem name="Vocals" color="var(--accent)" level={62} />
        <MiniStem name="Guitar" color="var(--live)" level={84} />
        <MiniStem name="Bass" color="oklch(0.66 0.09 250)" level={48} on={false} />
        <MiniStem name="Drums" color="oklch(0.7 0.05 40)" level={55} />
      </div>

      {/* structure ribbon */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {sections.map((s, i) => (
          <span
            key={s}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 99,
              background: i === active ? 'var(--accent-soft)' : 'var(--card-2)',
              color: i === active ? 'var(--accent-ink)' : 'var(--muted)',
              boxShadow: i === active ? 'none' : 'inset 0 0 0 1px var(--line-2)',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* waveform + transport */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2, height: 46 }}>
        {bars.map((b, i) => {
          const played = i / bars.length < LOOP_FROM / SONG_LENGTH;
          // Round to a fixed precision: the browser rounds long-float style
          // values when it reflects them, which would otherwise read as an
          // SSR/client hydration mismatch on every bar.
          return (
            <span
              key={i}
              style={{ flex: 1, height: `${(b * 100).toFixed(2)}%`, borderRadius: 2, background: played ? 'var(--accent)' : 'var(--hair)' }}
            />
          );
        })}
        <span
          ref={headRef}
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${((LOOP_FROM / SONG_LENGTH) * 100).toFixed(3)}%`,
            width: 2,
            borderRadius: 2,
            background: 'var(--accent)',
            boxShadow: '0 0 10px oklch(0.7 0.14 58 / 0.5)',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 99,
            background: 'var(--ink)',
            color: 'var(--paper)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="play" size={17} />
        </span>
        <span className="mono tnum" style={{ fontSize: 14, fontWeight: 700 }}>
          <span ref={timeRef}>1:28</span>
          <span style={{ color: 'var(--faint)' }}> / 4:49</span>
        </span>
        <span style={{ flex: 1 }} />
        <span className="chip" style={{ height: 27 }}>
          <Icon name="gauge" size={12} /> 0.75×
        </span>
        <span className="chip accent" style={{ height: 27 }}>
          <Icon name="loop" size={12} /> Verse 1
        </span>
      </div>
    </div>
  );
}

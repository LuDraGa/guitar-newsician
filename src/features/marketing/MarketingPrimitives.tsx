'use client';

/* ============================================================
   Marketing landing — shared primitives: pill, logo, reveal,
   cover art, deterministic waveform, low-friction email capture,
   section head, hero annotation.
   ============================================================ */
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';

import { BRAND } from './marketing-content';
import { Icon, type IconName } from './MarketingIcon';
import { joinWaitlist, type WaitlistSource } from './waitlist-client';

/* ---------- Pill ---------- */
export function Pill({
  icon,
  children,
  variant = '',
  className = '',
  ...rest
}: {
  icon?: IconName;
  children: ReactNode;
  variant?: '' | 'accent' | 'ghost';
} & ComponentPropsWithoutRef<'button'>) {
  return (
    <button className={`pill ${variant} ${className}`.trim()} {...rest}>
      {icon && (
        <span className="dot">
          <Icon name={icon} size={14} strokeWidth={2.1} />
        </span>
      )}
      {children}
    </button>
  );
}

/* ---------- Logo ---------- */
export function Logo({ size = 30 }: { size?: number }) {
  const dot = Math.round(size / 3);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: 99,
          background: 'var(--ink)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span
          style={{
            width: dot,
            height: dot,
            borderRadius: 99,
            boxShadow: '0 0 0 2px var(--paper), 0 0 0 4px var(--ink)',
            background: 'var(--accent)',
          }}
        />
      </span>
      <span className="display" style={{ fontSize: size * 0.63, letterSpacing: '-0.03em' }}>
        {BRAND.name}
      </span>
    </span>
  );
}

/* ---------- reveal on scroll ---------- */
export function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    // safety: never leave content hidden if the page is never scrolled
    // (idle viewers, print, screenshot/export contexts)
    const fallback = setTimeout(() => el.classList.add('in'), 2400);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return ref;
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  style,
  as,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  const ref = useReveal();
  const El = (as ?? 'div') as ElementType;
  return (
    <El ref={ref} className={`reveal ${className}`.trim()} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </El>
  );
}

/* ---------- deterministic pseudo-random (waveform bars) ---------- */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function waveBars(seed: number, n: number) {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const e = 0.4 + 0.6 * Math.sin(Math.PI * x);
    out.push(0.2 + e * (0.35 + r() * 0.65));
  }
  return out;
}

/* ---------- CoverArt (concentric-groove vinyl mark) ---------- */
export function CoverArt({ hue = 55, size = 56 }: { hue?: number; size?: number }) {
  const rings = [0.92, 0.74, 0.56, 0.4, 0.26];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(10, size * 0.2),
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(145deg, oklch(0.3 0.04 ${hue}), oklch(0.18 0.02 ${hue}))`,
      }}
    >
      {rings.map((r, i) => {
        // Round derived values: float noise (0.56 * 100 = 56.000…01) and float
        // opacity get re-serialized by the browser's CSSOM, which would read as
        // an SSR/client hydration mismatch.
        const pct = Math.round(r * 100);
        const ringAlpha = Math.round((0.12 + i * 0.04) * 100) / 100;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              margin: 'auto',
              width: `${pct}%`,
              height: `${pct}%`,
              borderRadius: 99,
              boxShadow: `0 0 0 1px oklch(0.7 0.06 ${hue} / ${ringAlpha})`,
            }}
          />
        );
      })}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: '14%',
          height: '14%',
          borderRadius: 99,
          background: `oklch(0.7 0.12 ${hue})`,
        }}
      />
    </div>
  );
}

/* ---------- low-friction email entry ----------
   Submitting joins the waitlist immediately (one field, one POST); the
   optional profile questions only appear afterwards, on the success state
   of the modal the parent opens via onJoined. */
export function EmailCapture({
  onJoined,
  source,
  align = 'left',
}: {
  onJoined: (email: string) => void;
  source: WaitlistSource;
  align?: 'left' | 'center';
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await joinWaitlist({ email: value, source });
      onJoined(value);
      setEmail('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        gap: 9,
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        maxWidth: 460,
        margin: align === 'center' ? '0 auto' : 0,
        width: '100%',
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className="field"
        disabled={busy}
        style={{ flex: '1 1 220px', minWidth: 0 }}
      />
      <Pill icon="arrowR" variant="accent" type="submit" disabled={busy}>
        {busy ? 'Joining…' : 'Join the waitlist'}
      </Pill>
      {failed && (
        <span role="alert" style={{ flexBasis: '100%', fontSize: 13.5, color: 'oklch(0.75 0.13 40)' }}>
          That didn’t save. Give it another try in a moment.
        </span>
      )}
    </form>
  );
}

/* ---------- section head ---------- */
export function SectionHead({
  eyebrow,
  title,
  intro,
  center,
  live,
  maxw = 620,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: string;
  center?: boolean;
  live?: boolean;
  maxw?: number;
}) {
  return (
    <Reveal
      style={{
        maxWidth: maxw,
        margin: center ? '0 auto' : 0,
        textAlign: center ? 'center' : 'left',
        marginBottom: 44,
      }}
    >
      {eyebrow && <span className={`eyebrow ${live ? 'live' : ''}`.trim()}>{eyebrow}</span>}
      <h2 className="display" style={{ fontSize: 'clamp(30px, 4vw, 46px)', margin: '16px 0 0' }}>
        {title}
      </h2>
      {intro && (
        <p style={{ marginTop: 16, fontSize: 17.5, lineHeight: 1.55, color: 'var(--muted)' }}>{intro}</p>
      )}
    </Reveal>
  );
}

/* ---------- hero annotation (luthier-bench motif) ---------- */
export function HeroAnnot({ children, live }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="annot">
      {live && (
        <span className="pulse" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--live)' }} />
      )}
      {children}
    </span>
  );
}

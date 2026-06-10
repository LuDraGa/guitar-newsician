'use client';

/* ============================================================
   Marketing landing — top nav (sticky, frosts on scroll).
   ============================================================ */
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Icon } from './MarketingIcon';
import { Logo, Pill } from './MarketingPrimitives';

const LINKS: [string, string][] = [
  ['#features', 'Features'],
  ['#who', "Who it's for"],
  ['#faq', 'FAQ'],
  ['#contact', 'Contact'],
];

export function MarketingNav({ onJoin }: { onJoin: (email: string) => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: solid ? 'oklch(0.945 0.006 75 / 0.82)' : 'transparent',
        backdropFilter: solid ? 'blur(10px)' : 'none',
        boxShadow: solid ? '0 1px 0 var(--line-2)' : 'none',
        transition: 'background 0.25s, box-shadow 0.25s',
      }}
    >
      <div className="wrap" style={{ height: 72, display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="#top" aria-label="Octave home">
          <Logo size={28} />
        </a>
        <nav className="nav-links" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {LINKS.map(([h, l]) => (
            <a
              key={h}
              href={h}
              style={{
                padding: '9px 14px',
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--muted)',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ink)';
                e.currentTarget.style.background = 'var(--card)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {l}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/app/library" className="pill ghost sm wc-hide-mobile" aria-label="Open the app">
            <span className="dot">
              <Icon name="arrowR" size={13} strokeWidth={2.1} />
            </span>
            Open the app
          </Link>
          <Pill icon="arrowR" variant="accent" className="sm" onClick={() => onJoin('')}>
            Join the waitlist
          </Pill>
        </div>
      </div>
    </header>
  );
}

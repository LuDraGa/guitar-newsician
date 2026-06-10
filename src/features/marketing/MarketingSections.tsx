'use client';

/* ============================================================
   Marketing landing — value props, features, who-it's-for, FAQ.
   ============================================================ */
import { useState } from 'react';

import { FAQS, FEATURES, VALUE_PROPS, WHO, type Feature } from './marketing-content';
import { Icon } from './MarketingIcon';
import { Reveal, SectionHead } from './MarketingPrimitives';
import { OPEN_CONCIERGE_EVENT } from './marketing-events';

/* ---------- value props ---------- */
export function ValueProps() {
  return (
    <section className="section" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap">
        <SectionHead
          title="The gap isn't talent. It's the slog of taking a song apart."
          intro="You've put in the hours. What slows you down is everything between hearing a song and playing it. Octave does that part."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {VALUE_PROPS.map((v, i) => (
            <Reveal key={v.k} delay={i * 50}>
              <div
                className="vp-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
                  gap: 32,
                  alignItems: 'start',
                  padding: '24px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 'clamp(20px, 2.4vw, 27px)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  {v.q}
                </h3>
                <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: 'var(--muted)', paddingTop: 4 }}>{v.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- features ---------- */
function FeatureCard({ f, i }: { f: Feature; i: number }) {
  const flag = f.flagship;
  return (
    <Reveal delay={(i % 3) * 60}>
      <div
        className="surface"
        style={{
          padding: 24,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: flag ? 'inset 0 0 0 1.5px var(--accent-soft), var(--shadow-card)' : 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: flag ? 'var(--accent)' : 'var(--ink)',
              color: flag ? 'oklch(0.99 0.01 80)' : 'var(--paper)',
            }}
          >
            <Icon name={f.icon} size={21} strokeWidth={1.8} />
          </span>
          <span className={`chip ${flag ? 'accent' : ''}`.trim()}>
            {f.tag}
            {flag && ' · flagship'}
          </span>
        </div>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{f.title}</h3>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--muted)' }}>{f.body}</p>
      </div>
    </Reveal>
  );
}

export function Features() {
  return (
    <section id="features" className="section">
      <div className="wrap">
        <SectionHead
          eyebrow="Tools"
          title="One song, taken all the way apart."
          intro="Everything you need to learn a track lives in one Studio — laid out like tools on a bench, not buried in menus."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.tag} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- who it's for ---------- */
export function WhoFor() {
  return (
    <section id="who" className="section" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap">
        <SectionHead eyebrow="Your fit" title="Built for players, not for day one." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <Reveal className="surface" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 99,
                  background: 'var(--live-soft)',
                  color: 'var(--live-ink)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="check" size={17} />
              </span>
              <span className="label" style={{ color: 'var(--live-ink)' }}>
                Octave is for you if
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {WHO.forYou.map((x, i) => (
                <li key={i} style={{ display: 'flex', gap: 11, fontSize: 16, lineHeight: 1.5 }}>
                  <Icon name="check" size={18} style={{ color: 'var(--live)', flexShrink: 0, marginTop: 2 }} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={80} className="surface-flat" style={{ padding: 28, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 99,
                  background: 'var(--card-2)',
                  color: 'var(--faint)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: 'inset 0 0 0 1px var(--line-2)',
                }}
              >
                <Icon name="x" size={15} />
              </span>
              <span className="label">Maybe not yet, if</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {WHO.notYet.map((x, i) => (
                <li key={i} style={{ display: 'flex', gap: 11, fontSize: 16, lineHeight: 1.5, color: 'var(--muted)' }}>
                  <Icon name="x" size={17} style={{ color: 'var(--faint)', flexShrink: 0, marginTop: 3 }} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQItem({ item, open, onToggle }: { item: { q: string; a: string }; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '22px 4px',
          fontSize: 'clamp(17px, 2vw, 20px)',
          fontWeight: 650,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        <span style={{ flex: 1 }}>{item.q}</span>
        <span
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: 99,
            display: 'grid',
            placeItems: 'center',
            background: open ? 'var(--ink)' : 'var(--card-2)',
            color: open ? 'var(--paper)' : 'var(--muted)',
            boxShadow: open ? 'none' : 'inset 0 0 0 1px var(--line-2)',
            transition: 'all 0.2s',
          }}
        >
          <Icon name="chevD" size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
        </span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ margin: 0, padding: '0 60px 24px 4px', fontSize: 16.5, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 760 }}>
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap">
        <SectionHead eyebrow="FAQ" title="The things people ask first." />
        <div style={{ borderBottom: '1px solid var(--line)' }}>
          {FAQS.map((f, i) => (
            <FAQItem key={i} item={f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
        <Reveal style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, color: 'var(--muted)' }}>Still wondering something?</span>
          <button
            className="chip accent"
            style={{ height: 34, fontSize: 13.5, cursor: 'pointer' }}
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONCIERGE_EVENT))}
          >
            <Icon name="sparkles" size={14} /> Ask Octavia
          </button>
        </Reveal>
      </div>
    </section>
  );
}

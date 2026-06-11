'use client';

/* ============================================================
   Marketing landing — middle scenes 3 and 4 (scene 2, TheBench,
   lives in BenchScene.tsx with its pinned scroll sequence):
   3. MaestroScene — the coach, shown as a living chat (seven
      conversations that play out in MaestroChat.tsx), with the
      mid-page capture moment.
   4. FitAndFaq — who it's for + five questions.
   ============================================================ */
import { useState } from 'react';

import { FAQS, MAESTRO, WHO } from './marketing-content';
import { Icon } from './MarketingIcon';
import { MaestroChatPlayer } from './MaestroChat';
import { EmailCapture, Reveal, SectionHead } from './MarketingPrimitives';
import { OPEN_CONCIERGE_EVENT } from './marketing-events';

export function MaestroScene({ onJoined }: { onJoined: (email: string) => void }) {
  return (
    <section id="maestro" className="section" style={{ background: 'var(--paper-2)' }}>
      <div
        className="wrap maestro-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <div>
          <SectionHead title={MAESTRO.title} intro={MAESTRO.intro} />
          <Reveal delay={80} style={{ marginTop: -8 }}>
            <EmailCapture onJoined={onJoined} source="maestro" />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--faint)' }}>
              <Icon name="sparkles" size={15} style={{ color: 'var(--accent-ink)' }} /> {MAESTRO.capture}
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="surface" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 14, borderBottom: '1px solid var(--line-2)' }}>
              <span
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: 99,
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="sparkles" size={17} />
                <span
                  style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 99, background: 'var(--live)', boxShadow: '0 0 0 2.5px var(--card)' }}
                />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Maestro</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>In the Studio, next to the transport</div>
              </div>
            </div>
            <MaestroChatPlayer />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- scene 4: who it's for + FAQ ---------- */
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

export function FitAndFaq() {
  const [open, setOpen] = useState(-1);
  return (
    <section id="fit" className="section">
      <div className="wrap">
        <SectionHead title="Is it for you?" />
        <div className="fit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <Reveal className="surface" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingLeft:28}}>
              <span className="label" style={{ color: 'var(--live-ink)' }}>
                Yes, if
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {WHO.forYou.map((x, i) => (
                <li key={i} style={{ display: 'flex', gap: 11, fontSize: 16, lineHeight: 1.5}}>
                  <Icon name="check" size={17} style={{ color: 'var(--live)', flexShrink: 0, marginTop: 2 }} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={80} className="surface-flat" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingLeft:28}}>
              <span className="label">Not yet, if</span>
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

        {/* five questions, same scene */}
        <div id="faq" style={{ marginTop: 72 }}>
          <SectionHead title="FAQ" />
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            {FAQS.map((f, i) => (
              <FAQItem key={i} item={f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            ))}
          </div>
          <Reveal style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15.5, color: 'var(--muted)' }}>Something else?</span>
            <button
              className="chip accent"
              style={{ height: 34, fontSize: 13.5, cursor: 'pointer' }}
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONCIERGE_EVENT))}
            >
              <Icon name="sparkles" size={14} /> Ask a question
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

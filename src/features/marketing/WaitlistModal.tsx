'use client';

/* ============================================================
   Marketing landing — waitlist modal (low friction, progressive).
   Email is the only required field; everything else is optional.
   Submission is UI-only this pass (see TODO below).
   ============================================================ */
import { useEffect, useRef, useState } from 'react';

import { HEARD, INSTRUMENTS, SKILL_LEVELS } from './marketing-content';
import { Icon } from './MarketingIcon';
import { Pill } from './MarketingPrimitives';

function ChoiceRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button type="button" key={o} className={`choice ${value === o ? 'on' : ''}`.trim()} onClick={() => onChange(value === o ? '' : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Labeled({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap' }}>{label}</span>
        {optional && (
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--faint)', letterSpacing: '0.04em' }}>
            optional
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/* Mounted only while open (the parent conditionally renders it), so initial
   state comes straight from props and the entrance animation runs on mount —
   no reset effect, no setState-in-effect. */
export function WaitlistModal({ prefillEmail, onClose }: { prefillEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(prefillEmail);
  const [d, setD] = useState({ name: '', instrument: '', skill: '', song: '', heard: '' });
  const [sent, setSent] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [pos] = useState(() => 1100 + Math.floor(Math.random() * 700));
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => firstRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
    };
  }, [onClose]);

  const set = (k: keyof typeof d) => (v: string) => setD((s) => ({ ...s, [k]: v }));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'oklch(0.2 0.01 60 / 0.42)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(24px, 6vh) 18px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface wl-pop"
        role="dialog"
        aria-modal="true"
        aria-label="Join the waitlist"
        style={{ width: '100%', maxWidth: 540, padding: 0, overflow: 'hidden' }}
      >
        {sent ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <span
              style={{
                width: 60,
                height: 60,
                borderRadius: 99,
                background: 'var(--live-soft)',
                color: 'var(--live-ink)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto',
              }}
            >
              <Icon name="check" size={30} strokeWidth={2.2} />
            </span>
            <h2 className="display" style={{ fontSize: 30, margin: '20px 0 0' }}>
              {"You're on the list."}
            </h2>
            <p style={{ margin: '14px auto 0', fontSize: 16, color: 'var(--muted)', maxWidth: 360, lineHeight: 1.55 }}>
              {"We'll email "}
              <strong style={{ color: 'var(--ink)' }}>{email}</strong>
              {' the moment your seat opens. Early invitees help shape where the product — and pricing — lands.'}
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                margin: '24px 0 4px',
                padding: '10px 18px',
                borderRadius: 99,
                background: 'var(--paper-2)',
                boxShadow: 'inset 0 0 0 1px var(--line-2)',
              }}
            >
              <span className="label" style={{ fontSize: 9.5 }}>
                Your spot
              </span>
              <span className="mono tnum" style={{ fontSize: 18, fontWeight: 700 }}>
                #{pos.toLocaleString()}
              </span>
            </div>
            <div>
              <Pill variant="ghost" className="sm" onClick={onClose} style={{ marginTop: 16 }}>
                Back to the site
              </Pill>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // TODO(marketing): persist the waitlist signup (email + optional
              // profile) once a Supabase table / API route exists. UI-only this pass.
              setSent(true);
            }}
          >
            <div style={{ padding: '26px 28px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ flex: 1 }}>
                <span className="eyebrow live">Soft launch</span>
                <h2 className="display" style={{ fontSize: 28, margin: '12px 0 0' }}>
                  Save your spot.
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  One field gets you on the list. The rest just helps us tailor your first session — skip anything.
                </p>
              </div>
              <button type="button" className="iconbtn" onClick={onClose} aria-label="Close" style={{ marginTop: -4 }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Labeled label="Email">
                <input
                  ref={firstRef}
                  className="field"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </Labeled>

              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
              >
                <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 99,
                    background: 'var(--card-2)',
                    boxShadow: 'inset 0 0 0 1px var(--line-2)',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 10.5, color: 'var(--faint)', letterSpacing: '0.08em', whiteSpace: 'nowrap', fontWeight: 500 }}
                  >
                    OPTIONAL · TAILORS YOUR FIRST SESSION
                  </span>
                  <Icon
                    name="chevD"
                    size={12}
                    style={{ color: 'var(--faint)', flexShrink: 0, transform: showOptional ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }}
                  />
                </span>
                <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
              </button>

              {showOptional && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Labeled label="Your name" optional>
                    <input className="field" value={d.name} onChange={(e) => set('name')(e.target.value)} placeholder="What should we call you?" />
                  </Labeled>
                  <Labeled label="Main instrument" optional>
                    <ChoiceRow options={INSTRUMENTS} value={d.instrument} onChange={set('instrument')} />
                  </Labeled>
                  <Labeled label="Where you're at" optional>
                    <ChoiceRow options={SKILL_LEVELS} value={d.skill} onChange={set('skill')} />
                  </Labeled>
                  <Labeled label="First song you'd bring" optional>
                    <input className="field" value={d.song} onChange={(e) => set('song')(e.target.value)} placeholder="The one you've always wanted to nail" />
                  </Labeled>
                  <Labeled label="How'd you hear about us" optional>
                    <ChoiceRow options={HEARD} value={d.heard} onChange={set('heard')} />
                  </Labeled>
                </div>
              )}
            </div>

            <div style={{ padding: '18px 24px 24px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Pill icon="arrowR" variant="accent" type="submit">
                Join the waitlist
              </Pill>
              <span style={{ fontSize: 13, color: 'var(--faint)' }}>No spam. Just your invite when a seat opens.</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

'use client';

/* ============================================================
   Marketing landing — waitlist modal.
   Two phases: "email" (only when opened from nav/footer; one
   required field, submitting joins immediately) and "joined"
   (the success state, where the optional profile questions live
   as a one-tap follow-up). Inline captures elsewhere on the page
   join first and open this modal directly on "joined".
   ============================================================ */
import { useEffect, useRef, useState } from 'react';

import { HEARD, INSTRUMENTS, SKILL_LEVELS } from './marketing-content';
import { Icon } from './MarketingIcon';
import { Pill } from './MarketingPrimitives';
import { joinWaitlist } from './waitlist-client';

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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ fontSize: 14, fontWeight: 650, whiteSpace: 'nowrap' }}>{label}</span>
      {children}
    </div>
  );
}

function ErrorNote() {
  return (
    <span role="alert" style={{ fontSize: 13.5, color: 'oklch(0.75 0.13 40)' }}>
      That didn’t save. Give it another try in a moment.
    </span>
  );
}

/* Mounted only while open (the parent conditionally renders it), so initial
   state comes straight from props and the entrance animation runs on mount. */
export function WaitlistModal({
  prefillEmail,
  startJoined,
  onClose,
}: {
  prefillEmail: string;
  startJoined: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'email' | 'joined'>(startJoined ? 'joined' : 'email');
  const [email, setEmail] = useState(prefillEmail);
  const [d, setD] = useState({ name: '', instrument: '', skill: '', song: '', heard: '' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
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

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await joinWaitlist({ email: value, source: 'modal' });
      setEmail(value);
      setPhase('joined');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || detailsSaved) return;
    const hasAny = Object.values(d).some((v) => v.trim());
    if (!hasAny) {
      onClose();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await joinWaitlist({ email, ...d });
      setDetailsSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'oklch(0.07 0.01 60 / 0.64)',
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
        {phase === 'joined' ? (
          <form onSubmit={submitDetails}>
            <div style={{ padding: '30px 28px 22px', textAlign: 'center', borderBottom: '1px solid var(--line-2)' }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 99,
                  background: 'var(--live-soft)',
                  color: 'var(--live-ink)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto',
                }}
              >
                <Icon name="check" size={28} strokeWidth={2.2} />
              </span>
              <h2 className="display" style={{ fontSize: 28, margin: '16px 0 0' }}>
                {"You're on the list."}
              </h2>
              <p style={{ margin: '10px auto 0', fontSize: 15, color: 'var(--muted)', maxWidth: 380, lineHeight: 1.55 }}>
                {"We'll email "}
                <strong style={{ color: 'var(--ink)' }}>{email}</strong>
                {' when your seat opens. Invites go out in order, through the soft launch.'}
              </p>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                Want your first session tailored? Tap what fits. Every field is optional.
              </p>
              <Labeled label="Main instrument">
                <ChoiceRow options={INSTRUMENTS} value={d.instrument} onChange={set('instrument')} />
              </Labeled>
              <Labeled label="Where you're at">
                <ChoiceRow options={SKILL_LEVELS} value={d.skill} onChange={set('skill')} />
              </Labeled>
              <Labeled label="First song you'd bring">
                <input className="field" value={d.song} onChange={(e) => set('song')(e.target.value)} placeholder="The one you've always wanted to nail" />
              </Labeled>
              <Labeled label="How'd you hear about us">
                <ChoiceRow options={HEARD} value={d.heard} onChange={set('heard')} />
              </Labeled>
            </div>

            <div style={{ padding: '18px 24px 24px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {detailsSaved ? (
                <>
                  <span className="chip live" style={{ height: 34, fontSize: 13.5 }}>
                    <Icon name="check" size={14} /> Saved. See you at the bench.
                  </span>
                  <Pill variant="ghost" className="sm" type="button" onClick={onClose}>
                    Done
                  </Pill>
                </>
              ) : (
                <>
                  <Pill icon="check" variant="accent" type="submit" disabled={busy}>
                    {busy ? 'Saving…' : 'Save details'}
                  </Pill>
                  <Pill variant="ghost" className="sm" type="button" onClick={onClose}>
                    Skip
                  </Pill>
                  {failed && <ErrorNote />}
                </>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={submitEmail}>
            <div style={{ padding: '26px 28px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ flex: 1 }}>
                <span className="eyebrow live">Soft launch</span>
                <h2 className="display" style={{ fontSize: 28, margin: '12px 0 0' }}>
                  Save your spot.
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  One field. You can tell us more after, or never.
                </p>
              </div>
              <button type="button" className="iconbtn" onClick={onClose} aria-label="Close" style={{ marginTop: -4 }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
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
            </div>

            <div style={{ padding: '18px 24px 24px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Pill icon="arrowR" variant="accent" type="submit" disabled={busy}>
                {busy ? 'Joining…' : 'Join the waitlist'}
              </Pill>
              {failed ? <ErrorNote /> : <span style={{ fontSize: 13, color: 'var(--faint)' }}>No spam. Just your invite when a seat opens.</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

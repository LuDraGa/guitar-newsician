'use client';

/* ============================================================
   Marketing landing — contact, final CTA, footer.
   The contact form is UI-only (no backend this pass).
   ============================================================ */
import { useState } from 'react';

import { BRAND } from './marketing-content';
import { Icon, type IconName } from './MarketingIcon';
import { EmailCapture, Logo, Pill, Reveal, SectionHead } from './MarketingPrimitives';

/* ---------- contact form ---------- */
function ContactForm() {
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: '', email: '', message: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  if (sent) {
    return (
      <div className="surface" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 99,
            background: 'var(--live-soft)',
            color: 'var(--live-ink)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="check" size={22} />
        </span>
        <h3 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Message on its way.</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 16, lineHeight: 1.5 }}>
          Thanks, {f.name || 'friend'}. We read everything during the soft launch and usually reply within a day or two.
        </p>
        <button
          className="pill ghost sm"
          onClick={() => {
            setSent(false);
            setF({ name: '', email: '', message: '' });
          }}
          style={{ marginTop: 4 }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="surface"
      style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        // TODO(marketing): persist contact submissions (no backend this pass).
        setSent(true);
      }}
    >
      <span className="label">Send a note</span>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input className="field" style={{ flex: '1 1 160px' }} placeholder="Your name" value={f.name} onChange={set('name')} required />
        <input className="field" style={{ flex: '1 1 160px' }} type="email" placeholder="you@email.com" value={f.email} onChange={set('email')} required />
      </div>
      <textarea
        className="field"
        rows={4}
        placeholder="What's on your mind? Bugs, feature ideas, a song you wish it handled better…"
        value={f.message}
        onChange={set('message')}
        required
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Pill icon="send" variant="accent" type="submit">
          Send message
        </Pill>
        <span style={{ fontSize: 13, color: 'var(--faint)' }}>Or email us directly.</span>
      </div>
    </form>
  );
}

function ContactCard({
  icon,
  label,
  title,
  sub,
  action,
}: {
  icon: IconName;
  label: string;
  title: string;
  sub: string;
  action: { href: string; ext?: boolean };
}) {
  return (
    <a
      href={action.href}
      target={action.ext ? '_blank' : undefined}
      rel={action.ext ? 'noreferrer' : undefined}
      className="surface-flat"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 20,
        background: 'var(--card)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--line-2)';
      }}
    >
      <span
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: 'var(--ink)',
          color: 'var(--paper)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={21} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="label" style={{ display: 'block' }}>
          {label}
        </span>
        <span style={{ display: 'block', fontSize: 16.5, fontWeight: 650, marginTop: 3 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</span>
      </span>
      <Icon name="arrowR" size={18} style={{ color: 'var(--faint)', flexShrink: 0 }} />
    </a>
  );
}

export function Contact() {
  return (
    <section id="contact" className="section">
      <div className="wrap">
        <SectionHead
          eyebrow="Get in touch"
          title="Talk to the people building it."
          intro="During the soft launch you're talking straight to the makers. Tell us what's working, what isn't, and what you wish it did."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          <Reveal>
            <ContactForm />
          </Reveal>
          <Reveal delay={80} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ContactCard
              icon="mail"
              label="Email"
              title={BRAND.email}
              sub="The fastest way to reach a human."
              action={{ href: `mailto:${BRAND.email}` }}
            />
            <ContactCard
              icon="calendar"
              label="Book a call"
              title="15 minutes, founder to player"
              sub="Grab a slot on Calendly."
              action={{ href: 'https://cal.com/abhiroop-prasad/30min', ext: true }}
            />
            <ContactCard
              icon="sheet"
              label="Support form"
              title="Log a bug or request"
              sub="Structured form for the detailed stuff."
              action={{ href: 'https://forms.gle/haicRh8Yt4t4xSDK6', ext: true }}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- final CTA ---------- */
export function FinalCTA({ onJoin }: { onJoin: (email: string) => void }) {
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal className="surface" style={{ padding: 'clamp(36px, 6vw, 72px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <span className="eyebrow live" style={{ justifyContent: 'center', display: 'inline-flex' }}>
            Seats opening through the soft launch
          </span>
          <h2 className="display" style={{ fontSize: 'clamp(34px, 5vw, 60px)', margin: '18px auto 0', maxWidth: 720 }}>
            {"Pick a song you've always wanted to play."}
          </h2>
          <p style={{ margin: '18px auto 0', fontSize: 18, color: 'var(--muted)', maxWidth: 480, lineHeight: 1.55 }}>
            {"Join the waitlist and we'll bring you onto the bench as we open seats."}
          </p>
          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
            <EmailCapture onJoin={onJoin} align="center" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- footer ---------- */
export function Footer({ onJoin }: { onJoin: (email: string) => void }) {
  const cols: [string, [string, string][]][] = [
    [
      'Product',
      [
        ['Features', '#features'],
        ["Who it's for", '#who'],
        ['FAQ', '#faq'],
      ],
    ],
    [
      'Company',
      [
        ['Contact', '#contact'],
        ['Email us', `mailto:${BRAND.email}`],
      ],
    ],
  ];
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-2)' }}>
      <div className="wrap footer-grid" style={{ padding: '56px 28px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))', gap: 32 }}>
        <div className="footer-brand">
          <Logo size={28} />
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.5 }}>
            {BRAND.tagline} A workbench for players who already play.
          </p>
          <button className="pill ghost sm" style={{ marginTop: 18 }} onClick={() => onJoin('')}>
            <span className="dot">
              <Icon name="arrowR" size={13} strokeWidth={2.1} />
            </span>
            Join the waitlist
          </button>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <span className="label">{title}</span>
            <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {links.map(([l, h]) => (
                <li key={l}>
                  <a
                    href={h}
                    style={{ fontSize: 15, color: 'var(--muted)', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="wrap"
        style={{
          padding: '20px 28px 36px',
          borderTop: '1px solid var(--line-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: 'var(--faint)' }}>
          © 2026 {BRAND.name} · {BRAND.domain}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Learn from music you own.</span>
      </div>
    </footer>
  );
}

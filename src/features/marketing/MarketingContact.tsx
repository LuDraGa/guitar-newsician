'use client';

/* ============================================================
   Marketing landing — final CTA (scene 5) + footer.
   Contact lives in the footer now (#contact): email, a call link,
   and the support form. No separate contact section.
   ============================================================ */
import { BRAND, FINAL_CTA } from './marketing-content';
import { EmailCapture, Logo, Reveal } from './MarketingPrimitives';
import { Icon } from './MarketingIcon';

/* ---------- final CTA ---------- */
export function FinalCTA({ onJoined }: { onJoined: (email: string) => void }) {
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal className="surface" style={{ padding: 'clamp(36px, 6vw, 72px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <span className="eyebrow live" style={{ justifyContent: 'center', display: 'inline-flex' }}>
            {FINAL_CTA.eyebrow}
          </span>
          <h2 className="display" style={{ fontSize: 'clamp(34px, 5vw, 60px)', margin: '18px auto 0', maxWidth: 720 }}>
            {FINAL_CTA.title}
          </h2>
          <p style={{ margin: '18px auto 0', fontSize: 18, color: 'var(--muted)', maxWidth: 480, lineHeight: 1.55 }}>
            {FINAL_CTA.sub}
          </p>
          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
            <EmailCapture onJoined={onJoined} source="final" align="center" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- footer (with contact folded in) ---------- */
export function Footer({ onJoin }: { onJoin: () => void }) {
  const cols: [string, [string, string, boolean?][]][] = [
    [
      'Product',
      [
        ['How it works', '#bench'],
        ['Maestro', '#maestro'],
        ["Who it's for", '#fit'],
        ['FAQ', '#faq'],
      ],
    ],
    [
      'Contact',
      [
        ['Email us', `mailto:${BRAND.email}`],
        ['Book a 15-min call', 'https://cal.com/abhiroop-prasad/30min', true],
        ['Report a bug', 'https://forms.gle/haicRh8Yt4t4xSDK6', true],
      ],
    ],
  ];
  return (
    <footer id="contact" style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-2)' }}>
      <div className="wrap footer-grid" style={{ padding: '56px 28px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))', gap: 32 }}>
        <div className="footer-brand">
          <Logo size={28} />
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.5 }}>
            {BRAND.tagline} A bench for players who already play.
          </p>
          <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--faint)', maxWidth: 280, lineHeight: 1.5 }}>
            During the soft launch you’re talking straight to the makers — we read everything.
          </p>
          <button className="pill ghost sm" style={{ marginTop: 18 }} onClick={onJoin}>
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
              {links.map(([l, h, ext]) => (
                <li key={l}>
                  <a
                    href={h}
                    target={ext ? '_blank' : undefined}
                    rel={ext ? 'noreferrer' : undefined}
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

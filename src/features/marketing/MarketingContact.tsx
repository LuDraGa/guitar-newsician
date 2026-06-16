'use client';

/* ============================================================
   Marketing landing — final CTA (scene 5) + footer.
   Contact lives in the footer now (#contact): email, a call link,
   and the support form. No separate contact section.
   ============================================================ */
import { ACCESS_TRACKS, BRAND, FINAL_CTA } from './marketing-content';
import { EmailCapture, Logo, Reveal } from './MarketingPrimitives';
import { Icon } from './MarketingIcon';

/* ---------- final CTA ---------- */
export function FinalCTA({ onJoined }: { onJoined: (email: string) => void }) {
  return (
    <section id="access" className="section" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal style={{ textAlign: 'center' }}>
          <span className="eyebrow live" style={{ justifyContent: 'center', display: 'inline-flex' }}>
            {FINAL_CTA.eyebrow}
          </span>
          <h2 className="display final-title" style={{ margin: '18px auto 0', maxWidth: 720 }}>
            {FINAL_CTA.title}
          </h2>
          <p style={{ margin: '18px auto 0', fontSize: 18, color: 'var(--muted)', maxWidth: 620, lineHeight: 1.55 }}>
            {FINAL_CTA.sub}
          </p>
        </Reveal>
        <div className="access-grid" style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {ACCESS_TRACKS.map((track, i) => (
            <Reveal key={track.source} delay={i * 80} className={track.live ? 'surface' : 'surface-flat'} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <span className={`eyebrow ${track.live ? 'live' : ''}`.trim()}>{track.eyebrow}</span>
                <h3 className="display" style={{ margin: '14px 0 0', fontSize: 30 }}>
                  {track.title}
                </h3>
                <p style={{ margin: '14px 0 0', fontSize: 16.5, lineHeight: 1.58, color: 'var(--muted)' }}>{track.body}</p>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <EmailCapture onJoined={onJoined} source={track.source} buttonLabel={track.button} placeholder="email for this track" />
                <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--faint)' }}>{track.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
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
        ['Maestro', '#maestro'],
        ['Songbook', '#songbook'],
        ["Who it's for", '#fit'],
        ['FAQ', '#faq'],
        ['Access', '#access'],
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
            {BRAND.tagline}
          </p>
          <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--faint)', maxWidth: 280, lineHeight: 1.5 }}>
            During private access, the product opens deliberately. The active beta gets direct feedback loops; the release track gets the polished room.
          </p>
          <button className="pill ghost sm" style={{ marginTop: 18 }} onClick={onJoin}>
            <span className="dot">
              <Icon name="arrowR" size={13} strokeWidth={2.1} />
            </span>
            Request access
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

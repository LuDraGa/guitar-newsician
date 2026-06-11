'use client';

/* ============================================================
   Marketing landing — Hero (scene 1: the gap). Problem-first:
   the headline names the pain, the sub resolves it, one field
   converts. The Studio glimpse sits alongside as quiet proof.
   ============================================================ */
import { HERO } from './marketing-content';
import { EmailCapture, HeroAnnot, Reveal } from './MarketingPrimitives';
import { Icon } from './MarketingIcon';
import { StudioGlimpse } from './StudioGlimpse';

export function MarketingHero({ onJoined }: { onJoined: (email: string) => void }) {
  return (
    <section className="section" style={{ paddingTop: 56, paddingBottom: 72 }}>
      <div
        className="wrap hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <div>
          <Reveal>
            <span className="eyebrow">{HERO.eyebrow}</span>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="display" style={{ fontSize: 'clamp(42px, 5.8vw, 76px)', margin: '20px 0 0', maxWidth: 640 }}>
              You can play.
              <br />
              So why can’t you play <span style={{ color: 'var(--accent-ink)', whiteSpace: 'nowrap' }}>that song?</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ marginTop: 22, fontSize: 18.5, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 470 }}>
              {HERO.sub}
            </p>
          </Reveal>
          <Reveal delay={180} style={{ marginTop: 30 }}>
            <EmailCapture onJoined={onJoined} source="hero" />
            <div
              style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--faint)' }}
            >
              <Icon name="check" size={15} style={{ color: 'var(--live)' }} /> {HERO.reassure}
            </div>
          </Reveal>
        </div>

        <Reveal delay={140} className="hero-art" style={{ position: 'relative' }}>
          <StudioGlimpse />
          <div style={{ position: 'absolute', top: -16, right: -10 }}>
            <HeroAnnot live>Stems ready</HeroAnnot>
          </div>
          <div style={{ position: 'absolute', bottom: 64, left: -34 }}>
            <HeroAnnot>Loop the hard bar</HeroAnnot>
          </div>
          <div style={{ position: 'absolute', bottom: -16, right: 22 }}>
            <HeroAnnot>Ask Maestro</HeroAnnot>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

'use client';

/* ============================================================
   Marketing landing — Hero (scene 1: the gap). Problem-first:
   the headline names the pain, the sub resolves it, one field
   converts. The Studio glimpse sits alongside as quiet proof,
   its annotations drifting gently; the atmosphere film (when a
   licensed clip exists) plays graded behind the whole scene.
   ============================================================ */
import { useRef } from 'react';

import { HERO } from './marketing-content';
import { EmailCapture, HeroAnnot, Reveal } from './MarketingPrimitives';
import { FilmLayer } from './FilmLayer';
import { Icon } from './MarketingIcon';
import { StudioGlimpse } from './StudioGlimpse';
import { gsap, useGSAP } from './gsap';

export function MarketingHero({ onJoined }: { onJoined: (email: string) => void }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to('.annot-float', {
          y: -6,
          duration: (i) => 2.8 + i * 0.7,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.45 },
        });
      });
    },
    { scope },
  );

  return (
    <section ref={scope} className="section" style={{ position: 'relative', paddingTop: 56, paddingBottom: 72 }}>
      <FilmLayer src="/marketing/film/hero.mp4" opacity={0.4} />
      <div
        className="wrap hero-grid"
        style={{
          position: 'relative',
          zIndex: 1,
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
            <h1 className="display" style={{ fontSize: 'clamp(36px, 5.8vw, 64px)', margin: '20px 0 0', maxWidth: 640 }}>
              Get that song out of your head and
              <br />
              <span style={{ color: 'var(--accent-ink)' }}>onto your guitar.</span>
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
          <div className="annot-float" style={{ position: 'absolute', top: -16, right: -10 }}>
            <HeroAnnot live>Stems ready</HeroAnnot>
          </div>
          <div className="annot-float" style={{ position: 'absolute', bottom: 64, left: -34 }}>
            <HeroAnnot>Loop the hard bar</HeroAnnot>
          </div>
          <div className="annot-float" style={{ position: 'absolute', bottom: -16, right: 22 }}>
            <HeroAnnot>Ask Maestro</HeroAnnot>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

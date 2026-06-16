'use client';

/* ============================================================
   Marketing landing — Hero (scene 1: the desire). Maestro leads:
   the copy names the song the learner wants to play, then the
   proof mock shows the intended coach session until the produced
   hero film exists.
   ============================================================ */
import { useRef } from 'react';

import { HERO } from './marketing-content';
import { CoverArt, EmailCapture, HeroAnnot, Reveal, waveBars } from './MarketingPrimitives';
import { FilmLayer } from './FilmLayer';
import { Icon } from './MarketingIcon';
import { gsap, useGSAP } from './gsap';

const HERO_WAVE = waveBars(93, 48);
const HERO_ARTIFACTS = ['Stems', 'Chords', 'Tab', 'Lyrics', 'Score', 'MIDI'];

function MaestroProofMock() {
  return (
    <div className="surface hero-proof" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="hero-proof-media"
        style={{
          position: 'relative',
          minHeight: 430,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <CoverArt hue={168} size={52} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="label" style={{ fontSize: 9.5 }}>
              Maestro session
            </div>
            <div className="display" style={{ marginTop: 3, fontSize: 21 }}>
              Song analysis ready
            </div>
          </div>
          <span className="chip live" style={{ height: 28 }}>
            <Icon name="sparkles" size={13} /> Coach active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
          {HERO_WAVE.map((b, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${(b * 100).toFixed(2)}%`,
                borderRadius: 2,
                background: i > 12 && i < 26 ? 'var(--accent)' : 'var(--hair)',
              }}
            />
          ))}
        </div>

        <div className="hero-proof-split">
          <div>
            <span className="label">Maestro recommends</span>
            <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 10 }}>
              {[
                'Start with the verse rhythm before the lead line.',
                'Loop bars 17-20 at 0.7x; the push lands on the and of two.',
                'Use the full voicing later. The simplified shape keeps the song moving now.',
              ].map((item, i) => (
                <li key={item} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'start' }}>
                  <span className="mono hero-step">{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <span className="label">Songbook surfaces</span>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {HERO_ARTIFACTS.map((item) => (
                <span key={item} className="chip" style={{ height: 29, justifyContent: 'center', fontSize: 12 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-maestro-bubble">
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 99,
              background: 'var(--ink)',
              color: 'var(--paper)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="sparkles" size={16} />
          </span>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
            The chorus is not harder because of new chords. It lifts because the rhythm opens up. Learn the count first, then add the fuller voicing.
          </p>
        </div>
      </div>
    </div>
  );
}

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
            <h1 className="display hero-title" style={{ margin: '20px 0 0', maxWidth: 690 }}>
              The song you keep hearing,
              <br />
              <span style={{ color: 'var(--accent-ink)' }}>taught for guitar.</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ marginTop: 22, fontSize: 18.5, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 470 }}>
              {HERO.sub}
            </p>
          </Reveal>
          <Reveal delay={180} style={{ marginTop: 30 }}>
            <EmailCapture onJoined={onJoined} source="hero" buttonLabel="Request an invite" />
            <div
              style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--faint)' }}
            >
              <Icon name="check" size={15} style={{ color: 'var(--live)' }} /> {HERO.reassure}
            </div>
          </Reveal>
        </div>

        <Reveal delay={140} className="hero-art" style={{ position: 'relative' }}>
          <MaestroProofMock />
          <div className="annot-float" style={{ position: 'absolute', top: -16, right: -10 }}>
            <HeroAnnot live>Maestro mapping</HeroAnnot>
          </div>
          <div className="annot-float" style={{ position: 'absolute', top: 210, left: -34 }}>
            <HeroAnnot>Evidence visible</HeroAnnot>
          </div>
          <div className="annot-float" style={{ position: 'absolute', bottom: -16, right: 22 }}>
            <HeroAnnot>Songbook saved</HeroAnnot>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

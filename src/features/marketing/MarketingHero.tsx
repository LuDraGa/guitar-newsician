'use client';

/* ============================================================
   Marketing landing — Hero ("The Bench": editorial, type-forward,
   the Studio glimpse alongside). The committed hero direction.
   ============================================================ */
import { EmailCapture, HeroAnnot, Reveal } from './MarketingPrimitives';
import { Icon } from './MarketingIcon';
import { StudioGlimpse } from './StudioGlimpse';

export function MarketingHero({ onJoin }: { onJoin: (email: string) => void }) {
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
            <span className="eyebrow">For players past the basics</span>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="display" style={{ fontSize: 'clamp(46px, 6.4vw, 84px)', margin: '20px 0 0', maxWidth: 620 }}>
              Take any song
              <br />
              to the <span style={{ color: 'var(--accent-ink)' }}>woodshed.</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ marginTop: 22, fontSize: 18.5, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 480 }}>
              You can already play. Octave pulls any recording apart — isolated stems, chords, tab, and sheet — with
              Maestro, an agent that talks you through the hard parts in plain language. Learn the song, not just the
              notes.
            </p>
          </Reveal>
          <Reveal delay={180} style={{ marginTop: 30 }}>
            <EmailCapture onJoin={onJoin} />
            <div
              style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--faint)' }}
            >
              <Icon name="check" size={15} style={{ color: 'var(--live)' }} /> Soft launch · early seats opening · no
              spam, just your invite.
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

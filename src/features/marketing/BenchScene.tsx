'use client';

/* ============================================================
   Scene 2 — TheBench. Desktop with motion allowed: the scene pins
   and scroll picks one of three beats — full mix, stems apart,
   transport + solo. The timeline then plays to that beat at its
   own pace (tweenTo), so a fast flick can never smear or skip the
   in-between states; it just changes the destination. Scroll snaps
   to the beat positions so the scene always comes to rest composed.
   Mobile / reduced-motion / no-JS: nothing is ever hidden by CSS —
   every "initial" state is applied inside the GSAP desktop branch
   only, so the static page simply shows the finished bench.
   ============================================================ */
import { useRef } from 'react';

import { BENCH_MOVES, CAPABILITIES } from './marketing-content';
import { Icon } from './MarketingIcon';
import { Reveal, SectionHead, waveBars } from './MarketingPrimitives';
import { ScrollTrigger, gsap, useGSAP } from './gsap';

/* ---------- stage pieces ---------- */
function MiniWave({ seed, n, color, height = 26 }: { seed: number; n: number; color: string; height?: number }) {
  const bars = waveBars(seed, n);
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height, flex: 1, minWidth: 0 }}>
      {bars.map((b, i) => (
        <span
          key={i}
          style={{ flex: 1, height: `${(b * 100).toFixed(2)}%`, borderRadius: 2, background: color, opacity: 0.85 }}
        />
      ))}
    </span>
  );
}

const LANES: { key: string; name: string; color: string; seed: number; solo?: boolean }[] = [
  { key: 'vocals', name: 'Vocals', color: 'var(--accent)', seed: 7 },
  { key: 'guitar', name: 'Guitar', color: 'var(--live)', seed: 19, solo: true },
  { key: 'bass', name: 'Bass', color: 'oklch(0.66 0.09 250)', seed: 31 },
  { key: 'drums', name: 'Drums', color: 'oklch(0.7 0.05 40)', seed: 43 },
];

function BenchStage() {
  return (
    <div className="surface bench-stage" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* the recording */}
      <div className="stage-mix">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="label">The recording</span>
          <span className="stage-meta" style={{ display: 'flex', gap: 6 }}>
            <span className="chip" style={{ height: 22, fontSize: 11 }}>
              Key B♭
            </span>
            <span className="chip" style={{ height: 22, fontSize: 11 }}>
              <span className="mono tnum">100</span>&nbsp;bpm
            </span>
            <span className="chip live" style={{ height: 22, fontSize: 11 }}>
              7 sections
            </span>
          </span>
        </div>
        <MiniWave seed={42} n={64} color="var(--muted)" height={34} />
      </div>

      {/* the parts */}
      <div className="stage-stems" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {LANES.map((l) => (
          <div
            key={l.key}
            className={`stem-lane lane-${l.key}`}
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '76px 1fr auto',
              alignItems: 'center',
              gap: 12,
              padding: '9px 12px',
              borderRadius: 12,
              background: 'var(--paper-2)',
              boxShadow: 'inset 0 0 0 1px var(--line-2)',
            }}
          >
            {l.solo && (
              <span
                aria-hidden
                className="lane-ring"
                style={{
                  position: 'absolute',
                  inset: -1,
                  borderRadius: 12,
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 1.5px var(--live), 0 0 20px oklch(0.72 0.11 168 / 0.22)',
                }}
              />
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: l.color }} /> {l.name}
            </span>
            <MiniWave seed={l.seed} n={48} color={l.color} />
            <span style={{ display: 'flex', gap: 4 }}>
              {(['M', 'S'] as const).map((x) => (
                <span
                  key={x}
                  style={{
                    width: 21,
                    height: 21,
                    borderRadius: 7,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    background: l.solo && x === 'S' ? 'var(--live-soft)' : 'var(--card-2)',
                    color: l.solo && x === 'S' ? 'var(--live-ink)' : 'var(--faint)',
                    boxShadow: 'inset 0 0 0 1px var(--line-2)',
                  }}
                >
                  {x}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* the transport */}
      <div className="stage-transport" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 99,
            background: 'var(--ink)',
            color: 'var(--paper)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="play" size={15} />
        </span>
        <span className="mono tnum" style={{ fontSize: 13.5, fontWeight: 700 }}>
          1:28<span style={{ color: 'var(--faint)' }}> / 4:49</span>
        </span>
        <span style={{ flex: 1 }} />
        <span className="chip" style={{ height: 26 }}>
          <Icon name="gauge" size={12} /> 0.75×
        </span>
        <span className="chip accent" style={{ height: 26 }}>
          <Icon name="loop" size={12} /> Pre
        </span>
      </div>
    </div>
  );
}

/* ---------- the scene ---------- */
export function TheBench() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
        const moves = gsap.utils.toArray<HTMLElement>('.bench-move', scope.current);

        // initial states live here, not in CSS — static renders show the
        // finished bench
        gsap.set(moves.slice(1), { opacity: 0.35 });
        gsap.set('.stem-lane', { opacity: 0, y: -16, scaleY: 0.7, transformOrigin: 'top center' });
        gsap.set('.lane-ring', { opacity: 0 });
        gsap.set('.stage-meta', { opacity: 0, y: 6 });
        gsap.set('.stage-transport', { opacity: 0, y: 10 });

        // Scroll no longer scrubs properties directly — it only chooses
        // a beat, and tweenTo plays the paused timeline to that label at
        // its own pace. A trackpad flick changes the destination, never
        // the path, so intermediate states can't be skipped or smeared.
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

        // beat 0 → 1: it comes apart
        tl.addLabel('mix')
          .to(moves[0], { opacity: 0.35, duration: 0.3 }, 0)
          .to(moves[1], { opacity: 1, duration: 0.3 }, 0)
          .to('.stage-mix', { opacity: 0.35, duration: 0.45 }, 0)
          .to('.stem-lane', { opacity: 1, y: 0, scaleY: 1, stagger: 0.12, duration: 0.5 }, 0.05)
          .to('.stage-meta', { opacity: 1, y: 0, duration: 0.3 }, 0.45)
          .addLabel('apart');

        // beat 1 → 2: play it in
        tl.to(moves[1], { opacity: 0.35, duration: 0.3 }, 'apart')
          .to(moves[2], { opacity: 1, duration: 0.3 }, 'apart')
          .to('.lane-vocals', { opacity: 0.38, duration: 0.35 }, 'apart')
          .to('.lane-ring', { opacity: 1, duration: 0.35 }, 'apart+=0.1')
          .to('.stage-transport', { opacity: 1, y: 0, duration: 0.4 }, 'apart+=0.15')
          .addLabel('play');

        const beats = ['mix', 'apart', 'play'] as const;
        let beat = 0;
        let beatTween: ReturnType<typeof tl.tweenTo> | null = null;

        const goTo = (next: number) => {
          if (next === beat) return;
          beat = next;
          beatTween?.kill();
          beatTween = tl.tweenTo(beats[next], { ease: 'power2.inOut' });
        };

        const st = ScrollTrigger.create({
          trigger: '.bench-pin',
          start: 'top top',
          end: '+=1700',
          pin: true,
          anticipatePin: 1,
          // rest only on a beat, so stopping mid-scroll still composes
          snap: {
            snapTo: [0, 0.5, 1],
            duration: { min: 0.2, max: 0.5 },
            delay: 0.1,
            ease: 'power1.inOut',
          },
          onUpdate: (self) => goTo(self.progress < 0.25 ? 0 : self.progress < 0.75 ? 1 : 2),
          onLeave: () => goTo(2),
          onLeaveBack: () => goTo(0),
        });

        // page may load (or resize into this breakpoint) already past the
        // scene — jump straight to the right beat instead of animating
        if (st.progress > 0) {
          beat = st.progress < 0.25 ? 0 : st.progress < 0.75 ? 1 : 2;
          tl.seek(beats[beat]);
        }
      });
    },
    { scope },
  );

  return (
    <section id="bench" ref={scope} style={{ position: 'relative' }}>
      <div className="bench-pin">
        <div className="wrap">
          <SectionHead title="The song comes apart." intro="Three steps between hearing it and playing it." />
          <div className="bench-grid">
            <ol className="bench-moves" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
              {BENCH_MOVES.map((s) => (
                <li key={s.n} className="bench-move" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--accent-ink)' }}>
                    {s.n}
                  </span>
                  <h3 style={{ margin: '8px 0 0', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.title}</h3>
                  <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>{s.body}</p>
                </li>
              ))}
            </ol>
            <BenchStage />
          </div>
        </div>
      </div>

      {/* what's on the bench — compact, one line per tool */}
      <div className="wrap section" style={{ paddingTop: 56 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.tag} delay={(i % 3) * 60}>
              <div
                className="surface-flat"
                style={{ padding: '16px 18px', height: '100%', display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--card-2)',
                    color: 'var(--accent-ink)',
                  }}
                >
                  <Icon name={c.icon} size={18} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="label" style={{ display: 'block' }}>
                    {c.tag}
                  </span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: 15, lineHeight: 1.5, color: 'var(--muted)' }}>
                    {c.line}
                  </span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* product film slot — the HeyGen Studio capture lands here (Phase 2+) */}
      </div>
    </section>
  );
}

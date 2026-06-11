'use client';

/* ============================================================
   MaestroChatPlayer — the Maestro card's living chat. Seven short
   conversations play like a real session: you ask, Maestro "works"
   (a music-flavored thinking line with dots), answers, and when a
   move is needed a small CTA inside his bubble fires and the
   transport chips update to show what he set up. A finished chat
   rests for a beat, then the next one starts in place (no slide).
   Tabs jump anywhere; the player pauses while hovered, focused,
   off-screen, or in a hidden browser tab. Reduced motion / no-JS:
   the selected conversation renders complete and static.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';

import { MAESTRO_BASE_CHIPS, MAESTRO_CHATS, type ChatChip, type MaestroChat, type MaestroChatTurn } from './marketing-content';
import { Icon } from './MarketingIcon';

const FIRST_DELAY = 700; // beat before a chat's opening message
const TURN_DELAY = 1100; // beat before a follow-up question
const COACH_DELAY = 550; // beat before the thinking bubble shows
const THINK_MS = 1600; // how long Maestro "works"
const PRESS_AT = 1000; // when the CTA auto-presses
const HOLD_MS = 5200; // finished chat rests before the next begins

function allActed(chat: MaestroChat) {
  const m: Record<number, boolean> = {};
  chat.turns.forEach((t, i) => {
    if (t.action) m[i] = true;
  });
  return m;
}

function finalChips(chat: MaestroChat): ChatChip[] {
  for (let i = chat.turns.length - 1; i >= 0; i--) {
    const a = chat.turns[i].action;
    if (a) return a.result;
  }
  return MAESTRO_BASE_CHIPS;
}

function Bubble({ turn, acted, pressing, onAct }: { turn: MaestroChatTurn; acted: boolean; pressing: boolean; onAct: () => void }) {
  const isCoach = turn.role === 'maestro';
  return (
    <div className="maestro-turn" style={{ display: 'flex', flexShrink: 0, justifyContent: isCoach ? 'flex-start' : 'flex-end' }}>
      <div
        style={{
          maxWidth: '86%',
          padding: '11px 14px',
          borderRadius: 16,
          borderBottomLeftRadius: isCoach ? 5 : 16,
          borderBottomRightRadius: isCoach ? 16 : 5,
          fontSize: 14.5,
          lineHeight: 1.5,
          background: isCoach ? 'var(--card-2)' : 'var(--ink)',
          color: isCoach ? 'var(--ink)' : 'var(--paper)',
          boxShadow: isCoach ? 'inset 0 0 0 1px var(--line-2)' : 'none',
        }}
      >
        {turn.text}
        {turn.action && (
          <div style={{ marginTop: 9 }}>
            <button
              type="button"
              className={`chip maestro-cta ${acted ? 'live' : 'accent'}${pressing ? ' pressing' : ''}`}
              disabled={acted}
              onClick={onAct}
              style={{ height: 28, fontSize: 12.5, cursor: acted ? 'default' : 'pointer' }}
            >
              <Icon name={acted ? 'check' : turn.action.icon} size={13} /> {turn.action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble({ line }: { line?: string }) {
  return (
    <div className="maestro-turn" style={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '11px 14px',
          borderRadius: 16,
          borderBottomLeftRadius: 5,
          background: 'var(--card-2)',
          color: 'var(--muted)',
          boxShadow: 'inset 0 0 0 1px var(--line-2)',
        }}
      >
        <span className="maestro-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span style={{ fontSize: 13, fontStyle: 'italic' }}>{line ?? 'Thinking…'}</span>
      </div>
    </div>
  );
}

export function MaestroChatPlayer() {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [acted, setActed] = useState<Record<number, boolean>>({});
  const [chips, setChips] = useState<ChatChip[]>(MAESTRO_BASE_CHIPS);
  const [chipsKey, setChipsKey] = useState(0);

  const [reduced, setReduced] = useState<boolean | null>(null); // null until measured
  const [inView, setInView] = useState(false);
  const [hoverHeld, setHoverHeld] = useState(false);
  const [focusHeld, setFocusHeld] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const chat = MAESTRO_CHATS[idx];
  // SSR / no-JS / reduced motion: render the selected conversation complete
  // and static, derived at render time (no state sync, no hydration flash)
  const isStatic = reduced !== false;
  const visibleTurns = isStatic ? chat.turns : chat.turns.slice(0, shown);
  const actedMap = isStatic ? allActed(chat) : acted;
  const shownChips = isStatic ? finalChips(chat) : chips;
  const playing = !isStatic && inView && !hoverHeld && !focusHeld && !docHidden;

  const fire = (i: number) => {
    const a = chat.turns[i]?.action;
    if (!a || acted[i]) return;
    setPressing(false);
    setActed((m) => ({ ...m, [i]: true }));
    setChips(a.result);
    setChipsKey((k) => k + 1);
  };

  const select = (i: number) => {
    setIdx(i);
    setThinking(false);
    setPressing(false);
    setShown(0);
    setActed({});
    setChips(MAESTRO_BASE_CHIPS);
    setChipsKey((k) => k + 1);
  };

  // measure prefers-reduced-motion, track changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // pause when scrolled away or the browser tab is hidden
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // the conversation engine: each state schedules its successor
  useEffect(() => {
    if (!playing) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const next = chat.turns[shown];
    const last = shown > 0 ? chat.turns[shown - 1] : undefined;
    const pendingAction = last?.role === 'maestro' && last.action && !acted[shown - 1];

    if (thinking) {
      timers.push(
        setTimeout(() => {
          setThinking(false);
          setShown((s) => s + 1);
        }, THINK_MS),
      );
    } else if (pendingAction) {
      timers.push(setTimeout(() => setPressing(true), PRESS_AT - 180));
      timers.push(setTimeout(() => fire(shown - 1), PRESS_AT));
    } else if (next) {
      if (next.role === 'maestro') timers.push(setTimeout(() => setThinking(true), COACH_DELAY));
      else timers.push(setTimeout(() => setShown((s) => s + 1), shown === 0 ? FIRST_DELAY : TURN_DELAY));
    } else {
      timers.push(setTimeout(() => select((idx + 1) % MAESTRO_CHATS.length), HOLD_MS));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, thinking, shown, acted, idx]);

  // keep the newest message in view, like a real chat
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [shown, thinking, idx, reduced]);

  return (
    <div
      ref={rootRef}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      onMouseEnter={() => setHoverHeld(true)}
      onMouseLeave={() => setHoverHeld(false)}
      onFocusCapture={() => setFocusHeld(true)}
      onBlurCapture={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setFocusHeld(false);
      }}
    >
      <div role="group" aria-label="Things you can ask Maestro" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MAESTRO_CHATS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={i === idx}
            onClick={() => select(i)}
            className="chip"
            style={{
              height: 26,
              fontSize: 12,
              cursor: 'pointer',
              ...(i === idx ? { background: 'var(--ink)', color: 'var(--paper)', boxShadow: 'none' } : {}),
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        ref={logRef}
        aria-label="Example conversation with Maestro"
        style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11, paddingRight: 2 }}
      >
        {visibleTurns.map((t, i) => (
          <Bubble
            key={`${chat.id}-${i}`}
            turn={t}
            acted={!!actedMap[i]}
            pressing={pressing && i === shown - 1}
            onAct={() => fire(i)}
          />
        ))}
        {thinking && <ThinkingBubble line={chat.turns[shown]?.thinking} />}
      </div>

      <div key={chipsKey} className="maestro-turn" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
        {shownChips.map((c, i) => (
          <span key={i} className={`chip${c.variant ? ` ${c.variant}` : ''}`} style={{ height: 26, fontSize: 12 }}>
            {c.icon && <Icon name={c.icon} size={12} />} {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}

'use client';

/* ============================================================
   Marketing landing — floating Concierge widget.
   Buyer/customer-facing: it answers "what is this, is it for me,
   what does it cost" for a prospect who hasn't signed up. This is
   NOT the in-product Studio coach — it's a concierge for the site.
   Unnamed in marketing (Maestro is the only agent the page sells);
   it introduces itself as Octavia only if a visitor asks who it is
   (kb/concierge).

   Retrieval is a deterministic keyword scorer over the local KB
   (a stand-in for embeddings) — no LLM, no backend, so it can only
   ever emit pre-written text. Queries it can't answer are routed by
   a three-tier guardrail:
     1. out-of-guardrails (piracy / redistribution) → firm refusal
        that restates the project's stance (learn from music you own).
     2. on-topic but unanswered → hand off to the team (contact CTA).
     3. off-topic & harmless → polite redirect to what it covers.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';

import { BRAND, KB, type KbEntry } from './marketing-content';
import { Icon } from './MarketingIcon';
import { OPEN_CONCIERGE_EVENT } from './marketing-events';

interface Message {
  role: 'bot' | 'user';
  text: string;
  sources?: string[];
  general?: boolean;
  /** Render a "talk to the team" action under the bubble. */
  cta?: 'contact';
}

const STOP = new Set(
  'the a an is are am do does did can could would will to of for what how why when where who my me you your it its with and or on in this that about be been has have had they them then so just at as i'.split(
    ' ',
  ),
);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

/* Project-domain vocabulary — used only to tell an on-topic-but-unanswered
   question ("do you integrate with Ableton?") apart from a truly off-topic one
   ("what's the weather"). Generous on purpose; routing, not gatekeeping. */
const DOMAIN = new Set(
  (
    'music song songs track tracks recording recordings audio sound guitar guitars bass vocal vocals voice singer drums drum keys keyboard piano synth instrument instruments chord chords tab tabs note notes scale scales mode tempo bpm rhythm timing beat pitch capo transpose transposition stem stems mix mixing master lyric lyrics verse chorus bridge intro outro riff riffs solo solos lick licks progression practice practise learn learning teach teaching lesson play playing player players perform performance ear theory transcribe transcription transcribing sheet notation score midi octave octavia studio waitlist price pricing cost costs subscription subscribe plan plans account signup login upload uploads analyze analysis separate isolate mute loop slow speed feel arrangement band cover daw ableton logic reaper key keys soft launch invite seat seats demo browser file format'
  ).split(/\s+/),
);

function isDomainRelevant(qt: string[]): boolean {
  return qt.some((t) => DOMAIN.has(t));
}

/* Out-of-guardrails intent: piracy / redistribution / reselling. Deliberately
   narrow so legitimate copyright questions (answered by kb/legal) and musician
   idiom ("steal that lick") don't trip it. */
function isOutOfGuardrails(q: string): boolean {
  if (/\b(pirate|pirated|pirating|piracy|torrent|torrenting|bootleg|bootlegs|warez|keygen|cracked|redistribute|redistributing|redistribution|resell|reselling|re-sell)\b/.test(q))
    return true;
  // "rip … and share/sell/distribute" — ripping to redistribute, not ripping a CD you own
  if (/\brip(?:ping|ped)?\b/.test(q) && /\b(share|sell|distribute|upload|post|redistribute|leak)\b/.test(q)) return true;
  return false;
}

/* Explicit "put me through to a person" intent — route straight to the team,
   regardless of whether anything in the KB happens to match. */
function wantsHuman(q: string): boolean {
  if (/\b(contact|get in touch|reach out|talk to a human|speak to someone|book a call)\b/.test(q)) return true;
  const who = /\b(dev|devs|developer|developers|founder|founders|team|human|humans|person|people|someone|somebody|sales|support|maker|makers|staff|owner|owners)\b/;
  const verb = /\b(talk|speak|reach|email|e-mail|call|chat|message|connect|ping)\b/;
  return who.test(q) && verb.test(q);
}

/* score every KB entry against the query; return ranked matches */
function retrieve(query: string): { e: KbEntry; score: number }[] {
  const qt = tokens(query);
  if (!qt.length) return [];
  return KB.map((e) => {
    const kwt = e.kw.split(/\s+/);
    const kwset = new Set(kwt);
    const topicset = new Set(tokens(e.topic));
    let score = 0;
    qt.forEach((t) => {
      if (kwset.has(t)) score += 1;
      else if (kwt.some((k) => k.length > 2 && t.length > 2 && (k.startsWith(t) || t.startsWith(k)))) score += 0.8; // loose stem (singular/plural)
      if (topicset.has(t)) score += 0.6;
    });
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function answerFor(query: string): Message {
  const q = query.trim().toLowerCase();

  // 1. Guardrails first — before greetings, so "hey, help me pirate this" can't
  //    slip through on the greeting shortcut.
  if (isOutOfGuardrails(q))
    return {
      role: 'bot',
      text: "Octave is for learning from music you own — so I can't help with pirating, ripping to redistribute, or reselling recordings. If you own the audio and want to take it apart and actually play it, that's exactly what it's built for.",
      sources: [],
    };

  if (/^(hi|hey|hello|yo|sup|howdy|gm|good (morning|evening|afternoon))\b/.test(q))
    return {
      role: 'bot',
      text: "Hey. Ask me how Octave works, what it transcribes, who it's for, what it'll cost — or anything music-side (theory, transcription, the analysis under the hood).",
      sources: [],
    };
  if (/(thank|thanks|cheers|appreciate|ty)\b/.test(q))
    return { role: 'bot', text: "Anytime. When you're ready, the waitlist button up top saves your spot.", sources: [] };

  // Wants a person, not me — hand off to the team before trying the KB.
  if (wantsHuman(q))
    return {
      role: 'bot',
      text: `Of course — the team's the right people for that. They read everything during the soft launch; reach them through the links in the footer, or at ${BRAND.email}.`,
      sources: [],
      cta: 'contact',
    };

  const ranked = retrieve(query);

  // Confident KB hit → answer.
  if (ranked.length && ranked[0].score >= 0.6) {
    const top = ranked[0].e;
    const srcs = ranked.slice(0, ranked[1] && ranked[1].score >= ranked[0].score * 0.55 ? 2 : 1).map((r) => r.e.id);
    return { role: 'bot', text: top.a, sources: srcs, general: top.general };
  }

  // No confident answer. If it's still on-topic (a weak KB signal, or it touches
  // the product/music domain) hand the prospect to the team rather than guessing.
  const onTopic = (ranked.length && ranked[0].score > 0) || isDomainRelevant(tokens(query));
  if (onTopic)
    return {
      role: 'bot',
      text: `That's a fair question, but it's past what I can answer confidently — I'd rather not guess. The team can give you a straight answer; reach them through the links in the footer, or at ${BRAND.email}.`,
      sources: [],
      cta: 'contact',
    };

  // Off-topic and harmless → say what I actually cover.
  return {
    role: 'bot',
    text: "I stick to Octave and the music side of it: how it works, what it transcribes, who it's for, pricing, and the analysis under the hood. Ask me anything there and I've got you.",
    sources: [],
  };
}

const STARTERS = [
  'What is Octave?',
  'Is this for beginners?',
  'Can it transpose to another key?',
  'What instruments does it support?',
  'What will it cost?',
];

function Bubble({ m, onContact }: { m: Message; onContact: () => void }) {
  const bot = m.role === 'bot';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: bot ? 'flex-start' : 'flex-end', gap: 6 }}>
      <div
        style={{
          maxWidth: '88%',
          padding: '11px 14px',
          borderRadius: 16,
          fontSize: 14.5,
          lineHeight: 1.5,
          background: bot ? 'var(--card-2)' : 'var(--ink)',
          color: bot ? 'var(--ink)' : 'var(--paper)',
          borderBottomLeftRadius: bot ? 5 : 16,
          borderBottomRightRadius: bot ? 16 : 5,
          boxShadow: bot ? 'inset 0 0 0 1px var(--line-2)' : 'none',
        }}
      >
        {m.text}
      </div>
      {bot && m.cta === 'contact' && (
        <button className="pill ghost sm" onClick={onContact} style={{ marginTop: 2 }}>
          <span className="dot">
            <Icon name="mail" size={13} strokeWidth={2.1} />
          </span>
          Talk to the team
        </button>
      )}
      {bot && m.sources && m.sources.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 2 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.04em' }}>
            retrieved
          </span>
          {m.sources.map((s) => (
            <span
              key={s}
              className="mono"
              style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 99 }}
            >
              {s}
            </span>
          ))}
          {m.general && (
            <span className="chip" style={{ height: 18, fontSize: 9.5, padding: '0 7px' }}>
              general
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Concierge() {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Message[]>([
    {
      role: 'bot',
      text: "Hey — ask me anything about Octave: how it works, what it transcribes, who it's for, what it'll cost. What do you want to know?",
      sources: [],
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setTimeout(() => inRef.current?.focus(), 120);
    };
    window.addEventListener(OPEN_CONCIERGE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONCIERGE_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing, open]);

  const goToContact = () => {
    setOpen(false);
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    const ans = answerFor(q);
    const delay = 480 + Math.min(900, ans.text.length * 7);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, ans]);
    }, delay);
  };

  const showStarters = msgs.filter((m) => m.role === 'user').length === 0;

  return (
    <>
      {/* launcher (ink, not accent — the waitlist owns the one accent action) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask about Octave"
        style={{
          position: 'fixed',
          right: 'clamp(16px, 3vw, 28px)',
          bottom: 'clamp(16px, 3vw, 28px)',
          zIndex: 70,
          height: 54,
          padding: open ? 0 : '0 22px 0 18px',
          width: open ? 54 : 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          borderRadius: 99,
          background: 'var(--ink)',
          color: 'var(--paper)',
          fontWeight: 600,
          fontSize: 15,
          boxShadow: 'var(--shadow-pop)',
          transition: 'all 0.2s ease',
          justifyContent: 'center',
        }}
      >
        <Icon name={open ? 'x' : 'sparkles'} size={20} strokeWidth={2} />
        {!open && <span>Ask about Octave</span>}
      </button>

      {open && (
        <div
          className="surface concierge-panel"
          style={{
            position: 'fixed',
            right: 'clamp(12px, 3vw, 28px)',
            bottom: 'clamp(80px, 10vh, 96px)',
            zIndex: 71,
            width: 'min(384px, calc(100vw - 24px))',
            height: 'min(580px, calc(100vh - 140px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', borderBottom: '1px solid var(--line-2)' }}>
            <span
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: 99,
                background: 'var(--ink)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--paper)',
              }}
            >
              <Icon name="sparkles" size={18} />
              <span
                style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 99, background: 'var(--live)', boxShadow: '0 0 0 2.5px var(--card)' }}
              />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em' }}>Ask Octave</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Product questions, answered</div>
            </div>
            <button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close" style={{ width: 34, height: 34 }}>
              <Icon name="chevD" size={18} />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {msgs.map((m, i) => (
              <Bubble key={i} m={m} onContact={goToContact} />
            ))}
            {typing && (
              <div
                style={{
                  display: 'inline-flex',
                  gap: 4,
                  padding: '12px 14px',
                  borderRadius: 16,
                  borderBottomLeftRadius: 5,
                  background: 'var(--card-2)',
                  alignSelf: 'flex-start',
                  boxShadow: 'inset 0 0 0 1px var(--line-2)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--muted)', animation: `concierge-typing 1.2s ${i * 0.15}s infinite` }} />
                ))}
              </div>
            )}
            {showStarters && !typing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
                <span className="label" style={{ fontSize: 9.5, marginBottom: 2 }}>
                  Try asking
                </span>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    style={{
                      textAlign: 'left',
                      padding: '9px 13px',
                      borderRadius: 12,
                      fontSize: 13.5,
                      fontWeight: 500,
                      background: 'var(--card)',
                      color: 'var(--ink)',
                      boxShadow: 'inset 0 0 0 1px var(--line)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card)')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            style={{ padding: 12, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <input ref={inRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about Octave…" className="field" style={{ height: 44, flex: 1 }} />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Send"
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                background: input.trim() && !typing ? 'var(--accent)' : 'var(--card-2)',
                color: input.trim() && !typing ? 'oklch(0.99 0.01 80)' : 'var(--faint)',
                transition: 'background 0.15s',
                boxShadow: input.trim() ? 'none' : 'inset 0 0 0 1px var(--line-2)',
              }}
            >
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

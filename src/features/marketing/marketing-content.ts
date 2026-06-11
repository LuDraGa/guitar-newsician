/* ============================================================
   Marketing landing — site content + Concierge knowledge base.
   Voice: plain words, musician warmth. Grade 6–8 reading level,
   short sentences, one idea per line. Headers either say the
   thing or label the section — never an eyebrow + witty sentence.
   Maestro (the in-Studio coach) is the only agent named in page
   copy; the site concierge is unnamed in marketing and only
   introduces herself (Octavia) if a visitor asks who she is.
   ============================================================ */
import type { IconName } from './MarketingIcon';

export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  email: string;
}

export interface BenchMove {
  n: string;
  title: string;
  body: string;
}

export interface Capability {
  icon: IconName;
  tag: string;
  line: string;
}

export interface MaestroTurn {
  role: 'you' | 'maestro';
  text: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface KbEntry {
  id: string;
  topic: string;
  kw: string;
  a: string;
  general?: boolean;
}

export const BRAND: Brand = {
  name: 'Octave',
  domain: 'octave.studio',
  tagline: 'Take any song to the woodshed.',
  // email: 'hello@octave.studio',
  email: 'abhirooprasad@gmail.com',
};

/* ---------- hero (scene 1: the gap) ---------- */
export const HERO = {
  eyebrow: 'For players past the basics',
  // headline is composed in the component so "that song" can carry the accent
  sub: 'Drop in a recording you own. Octave pulls out the parts, the chords, and the words — so you learn it piece by piece, and actually play it.',
  reassure: 'Soft launch — no spam, just your invite.',
};

/* ---------- the bench (scene 2: three moves) ---------- */
export const BENCH_MOVES: BenchMove[] = [
  {
    n: '01',
    title: 'Bring a song',
    body: 'Upload a recording you own. That’s the whole setup.',
  },
  {
    n: '02',
    title: 'It comes apart',
    body: 'Stems split out. Chords, words, and structure show up on screen. Minutes, not weekends.',
  },
  {
    n: '03',
    title: 'Play it in',
    body: 'Solo your part. Slow the hard bar. Loop it until it sits. Then bring the band back in.',
  },
];

/* ---------- the bench (scene 2: what's on it) ---------- */
export const CAPABILITIES: Capability[] = [
  {
    icon: 'scissors',
    tag: 'Stems',
    line: 'Mute the singer. Pull the bass forward. Hear only your part.',
  },
  {
    icon: 'guitar',
    tag: 'Chords + tab',
    line: 'Written out over the bars, right where you need them.',
  },
  {
    icon: 'type',
    tag: 'Lyrics',
    line: 'Words locked to the music, so you never lose your place.',
  },
  {
    icon: 'sheet',
    tag: 'Notation',
    line: 'Clean sheet music, one instrument at a time.',
  },
  {
    icon: 'gauge',
    tag: 'Speed + loop',
    line: 'Slow it down without changing pitch. Loop the bars that fight you.',
  },
  {
    icon: 'loop',
    tag: 'Key',
    line: 'Move it to fit your voice or your capo.',
  },
];

/* ---------- maestro (scene 3: the coach) ---------- */
export const MAESTRO = {
  title: 'Stuck? Ask Maestro.',
  intro:
    'Maestro is the coach inside the Studio. Ask in plain words. It answers like a musician — and sets up the bench for you.',
  capture: 'Maestro comes with every seat.',
};

export const MAESTRO_EXCHANGE: MaestroTurn[] = [
  { role: 'you', text: 'What’s happening in the chorus?' },
  {
    role: 'maestro',
    text: 'Same four chords as the verse — G, D, Em, C. The lift comes from the strumming, not new chords. Want it looped at half speed?',
  },
  { role: 'you', text: 'Put it in a key I can sing.' },
  { role: 'maestro', text: 'Moved it to C. Capo 2 keeps your open shapes.' },
];

/* ---------- who it's for (scene 4) ---------- */
export const WHO: { forYou: string[]; notYet: string[] } = {
  forYou: [
    'You can play open chords and a scale or two.',
    'You learn by ear or by tab, and want both lined up with the recording.',
    'You teach, and want clean parts to hand to a student.',
    'You write, and want to lift a feel or a progression.',
  ],
  notYet: [
    'You’ve never held the instrument. Learn the basics first — we’ll be here.',
    'You want karaoke or a streaks game. That’s not this.',
  ],
};

/* ---------- FAQ (scene 4, five questions) ---------- */
export const FAQS: Faq[] = [
  {
    q: 'What does Octave do?',
    a: 'You give it a recording you own. It splits out the parts, finds the key and tempo, syncs the words, and writes out chords, tab, and notation. Then you learn the song piece by piece — and play along.',
  },
  {
    q: 'Is it for beginners?',
    a: 'Not yet. If you can change between open chords and play a simple scale, you’re in. If it’s day one, learn the basics first — Octave will be here.',
  },
  {
    q: 'Which instruments does it cover?',
    a: 'Strongest on guitar, bass, vocals, keys, and drums today. More instruments land through the soft launch.',
  },
  {
    q: 'Do I upload my own music?',
    a: 'Yes. You bring audio you own — there’s no catalog, and we don’t host or share your files. Learning from your own music is the whole point.',
  },
  {
    q: 'What will it cost?',
    a: 'Not final yet. Early invitees get in first and help set the price. Join the waitlist and you’ll hear from us as seats open.',
  },
];

/* ---------- final CTA (scene 5) ---------- */
export const FINAL_CTA = {
  eyebrow: 'Seats opening through the soft launch',
  title: 'Pick the song you’ve always wanted to play.',
  sub: 'Join the waitlist. We’ll bring you in as seats open.',
};

/* ---------- waitlist options ---------- */
export const INSTRUMENTS = ['Guitar', 'Bass', 'Vocals', 'Keys', 'Drums', 'Other'];
export const SKILL_LEVELS = ['Intermediate', 'Advanced', 'Pro / teaching'];
export const HEARD = ['A friend', 'Reddit / forum', 'YouTube', 'Search', 'Social', 'Other'];

/* ---------- Concierge knowledge base (simulated semantic retrieval) ----------
   Each entry has keywords used to score a query (stand-in for embeddings),
   a short passage "id" for the retrieval chip, and the answer. The concierge is
   strictly about the product, with a few honest general-music answers. */
export const KB: KbEntry[] = [
  {
    id: 'kb/overview',
    topic: 'What Octave is',
    kw: 'what is octave do product about overview purpose explain summary work works working how learn learning use',
    a: 'Octave turns a recording into a workbench. It splits out the parts, finds key, tempo, and structure, syncs the words, and writes out chords, tab, and notation — all in one Studio where you isolate parts, slow things down, loop, and play along.',
  },
  {
    id: 'kb/maestro',
    topic: 'Maestro, the in-app coach',
    kw: 'maestro coach assistant agent ai help guide explain natural language ask question chat studio app in-app inside product voicing pattern',
    a: 'Maestro is the coach inside the Studio. Ask it to explain a voicing, name a pattern, walk you through tab, move a song to a new key, or simplify a busy part — in plain words, anchored to where you are in the song.',
  },
  {
    id: 'kb/concierge',
    topic: 'The site concierge',
    kw: 'octavia concierge you who are this bot site help talking here assistant name',
    a: 'I’m Octavia — the site concierge. I answer what Octave does, who it’s for, and what it’ll cost. Inside the Studio, the coach you’ll actually work with is Maestro.',
  },
  {
    id: 'kb/stems',
    topic: 'Stem separation',
    kw: 'stems separate isolate mute solo vocals bass drums guitar parts track split',
    a: 'Stem separation splits the mix into parts — vocals, bass, drums, and more — so you can solo the line you’re learning or mute the singer. You hear exactly the part you need, nothing else.',
  },
  {
    id: 'kb/transcription',
    topic: 'Transcription accuracy',
    kw: 'transcription accurate accuracy correct chords tab notation midi automatic amt',
    a: 'Automatic transcription gives you chords, tab, and notation good enough to learn from. Chords and structure are reliable; dense or lo-fi mixes are harder. Anything off, you fix in the editor — and the fix sticks.',
  },
  {
    id: 'kb/transpose',
    topic: 'Key, tempo, feel',
    kw: 'transpose key change tempo slow speed pitch capo mood feel transposition',
    a: 'You can slow a passage without changing pitch, loop a bar, and move the song to fit your voice or your capo. Tell Maestro what you want and it sets up the transport for you.',
  },
  {
    id: 'kb/instruments',
    topic: 'Supported instruments',
    kw: 'instrument support guitar bass vocals keys piano drums what which play',
    a: 'Today it’s strongest on guitar, bass, vocals, keys, and drums, with tab and chords leaning guitar-forward. More instruments arrive through the soft launch.',
  },
  {
    id: 'kb/beginner',
    topic: 'Who it’s for',
    kw: 'beginner beginners skill level intermediate advanced who for new start novice experienced fit right',
    a: 'Octave is for players past the basics who want to learn real songs faster. If you’ve never held the instrument, learn the fundamentals first — this is a bench for taking songs apart, not a first lesson.',
  },
  {
    id: 'kb/upload',
    topic: 'Bringing your own audio',
    kw: 'upload song audio file own catalog where source import bring',
    a: 'You bring the audio you own and Octave does the analysis. It’s not a streaming catalog — it’s the bench you take your own material to.',
  },
  {
    id: 'kb/pricing',
    topic: 'Pricing & access',
    kw: 'price pricing cost free trial subscription pay money plan waitlist access',
    a: 'Pricing isn’t locked yet. Early invitees get in first and help set where it lands. Join the waitlist and we’ll bring you in as seats open.',
  },
  {
    id: 'kb/legal',
    topic: 'Rights & legality',
    kw: 'legal copyright rights law allowed legitimate own redistribute host',
    a: 'Learning from music you own, for your own practice, is exactly the use we’re built for. You’re responsible for the rights to what you upload; we don’t host or redistribute copyrighted recordings.',
  },
  {
    id: 'kb/theory',
    topic: 'Music theory (general)',
    general: true,
    kw: 'theory chord scale key mode interval progression diatonic circle fifths harmony ii turnaround cadence resolve voicing',
    a: 'Happy to talk theory in general terms — a major scale’s diatonic chords, a ii–V–I, relative minors, the circle of fifths. Inside the Studio, Maestro ties it to the actual song: which chord you’re on and why it pulls where it does.',
  },
  {
    id: 'kb/mir',
    topic: 'Music information retrieval (general)',
    general: true,
    kw: 'mir music information retrieval beat tracking key detection onset tempo estimation analysis',
    a: 'Music information retrieval is the field behind a lot of this — beat tracking, key and tempo estimation, chord recognition, structure segmentation. Octave leans on those techniques to turn a waveform into something you can read and play.',
  },
  {
    id: 'kb/amt',
    topic: 'Automatic transcription (general)',
    general: true,
    kw: 'amt automatic music transcription notes pitch detection note tracking polyphonic',
    a: 'Automatic music transcription is the task of turning audio into notes — pitches, timing, sometimes fingering. It’s hard for dense, polyphonic mixes, which is why Octave pairs it with an editor and Maestro instead of pretending it’s perfect.',
  },
];

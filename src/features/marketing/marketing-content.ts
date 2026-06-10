/* ============================================================
   Marketing landing — site content + Concierge knowledge base.
   Voice: a knowledgeable musician friend. Plainspoken, no hype.
   Copy is from the Claude-designed source. Two distinct agents are
   named: Octavia (the site concierge) and Maestro (the in-product
   Studio coach). In-product coaching references say "Maestro";
   "Octavia" is the concierge only.
   ============================================================ */
import type { IconName } from './MarketingIcon';

export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  email: string;
}

export interface ValueProp {
  k: string;
  q: string;
  a: string;
}

export interface Feature {
  icon: IconName;
  tag: string;
  title: string;
  body: string;
  flagship?: boolean;
}

export interface AntiPositioning {
  not: string;
  line: string;
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
  email: 'hello@octave.studio',
};

/* ---------- value props (the "why") ---------- */
export const VALUE_PROPS: ValueProp[] = [
  {
    k: 'play-in-front',
    q: "Been playing a while, but freeze when it's time to actually play a song front to back?",
    a: "Octave breaks the recording down so you can learn it the way it's built — section by section, part by part — until it's under your fingers.",
  },
  {
    k: 'hear-it-play-it',
    q: 'Hear something great and wish you could just play it?',
    a: 'Drop the track in. You get isolated stems, chords, tab, and notation for the part you care about — not a wall of theory.',
  },
  {
    k: 'cant-read',
    q: "Can't read tab or sheet music fluently?",
    a: 'Ask Maestro. It walks you through the notation in plain language and points at exactly where you are in the bar.',
  },
  {
    k: 'patterns',
    q: 'Struggle to spot the patterns that make a song click?',
    a: 'Maestro names the shape — the turnaround, the repeated riff, the key change — so the next song comes faster than the last.',
  },
  {
    k: 'transpose',
    q: 'Want it in a different key, or a different feel?',
    a: 'Tell Maestro. Transpose to fit your voice or your capo, simplify a busy part, or change the mood — without leaving the bench.',
  },
];

/* ---------- feature highlights ---------- */
export const FEATURES: Feature[] = [
  {
    icon: 'scissors',
    tag: 'Stems',
    title: "Solo the part you're learning",
    body: "Mute the singer, pull the bass forward, isolate the rhythm guitar. Hear exactly the line you're working on, nothing else.",
  },
  {
    icon: 'type',
    tag: 'Lyrics sync',
    title: 'Words locked to the waveform',
    body: 'Lyrics scroll in time with the track, so you always know where you are — verse, pre, chorus, bridge — without hunting.',
  },
  {
    icon: 'guitar',
    tag: 'Chords + tab',
    title: 'Auto-transcribed, where you need it',
    body: 'Chords over the bars and tab for the part that matters. Fingerings you can actually read, not a dump of every note in the mix.',
  },
  {
    icon: 'sheet',
    tag: 'Notation',
    title: 'Readable sheet, one instrument at a time',
    body: 'Single-instrument notation you can follow — or hand to a student — instead of a dense orchestral score nobody asked for.',
  },
  {
    icon: 'gauge',
    tag: 'Transport',
    title: 'Slow it down, loop the hard bar',
    body: 'Drop the tempo without dropping the pitch, loop the two bars that keep fighting you, and shift the key — exact, tabular, never jittery.',
  },
  {
    icon: 'sparkles',
    tag: 'Maestro',
    flagship: true,
    title: 'An agent that talks like a musician',
    body: 'Stuck on a voicing or a rhythm? Ask in plain language. Maestro explains the part, names the pattern, and can transpose or change the feel on request.',
  },
];

/* ---------- who it's for ---------- */
export const WHO: { forYou: string[]; notYet: string[] } = {
  forYou: [
    "You can already play — you're past day one and want to learn real songs faster.",
    'You learn by ear or by tab and want both lined up against the actual recording.',
    'You teach, and want clean per-instrument parts to hand to a student.',
    'You write, and want to lift a progression or a feel and make it your own.',
  ],
  notYet: [
    "You've literally never held the instrument — start with fundamentals first, then come back.",
    "You want a karaoke party app or a streak-and-badges game. That's not this.",
  ],
};

/* ---------- anti-DAW positioning ---------- */
export const ANTI: AntiPositioning[] = [
  {
    not: 'A legacy DAW',
    line: 'No wall of knobs, no engineer-only panels. Depth shows up when you reach for it, not before.',
  },
  {
    not: 'A toy',
    line: "No badges, no confetti, no cartoon mascot trivializing the craft. It respects that you're doing real work.",
  },
  {
    not: 'Generic AI software',
    line: "No purple gradients, no 'supercharge your workflow.' One tool, used precisely, on a warm bench.",
  },
];

/* ---------- FAQ ---------- */
export const FAQS: Faq[] = [
  {
    q: 'What does Octave actually do?',
    a: 'You give it a recording. It separates the stems, detects key/tempo/structure, aligns the lyrics, and transcribes chords, tab, and notation — then brings it all into one Studio where you can isolate parts, slow things down, loop a bar, and play along. Maestro is there whenever a part needs explaining.',
  },
  {
    q: 'Is this for beginners?',
    a: "Not really. Octave assumes you can already play and want to learn songs faster. If you're on day one with the instrument, build your fundamentals first — Octave will be waiting when you want to take real songs apart.",
  },
  {
    q: 'Do I need to read sheet music or tab?',
    a: "No. You'll move faster if you read a little, but Maestro explains any part in plain language and shows you exactly where you are. Reading better is a side effect, not a prerequisite.",
  },
  {
    q: 'Which instruments does it support?',
    a: "It's strongest on guitar, bass, vocals, keys, and drums today — stems, chords, and tab lean guitar-forward. More instruments and per-part notation land through the soft launch.",
  },
  {
    q: 'How accurate is the transcription?',
    a: 'Good enough to learn from, and honest about its limits. Chords and structure are reliable; dense or lo-fi mixes are harder. You can correct anything in the editor, and corrections stick.',
  },
  {
    q: 'Can I change the key or tempo?',
    a: "Yes. Slow a passage down without changing pitch, loop the bar that's fighting you, and transpose to fit your voice or your capo. Tell Maestro what you want and it'll set it up.",
  },
  {
    q: 'Where do songs come from — can I upload my own?',
    a: "You bring the audio. Upload a file you own and Octave does the rest. We're not a catalog; we're the bench you take your own material to.",
  },
  {
    q: 'What about copyright and licensing?',
    a: "Learning from music you own, for your own practice, is exactly what we're built for. You're responsible for having the rights to what you upload; we don't host, stream, or redistribute copyrighted recordings. It stays on your machine.",
  },
  {
    q: 'What will it cost?',
    a: "Pricing isn't final. Soft-launch invitees get early access and a say in where pricing lands. Join the waitlist and we'll bring you in as we open seats.",
  },
  {
    q: 'What do I need to run it?',
    a: 'A modern browser and the audio you want to learn. Heavy analysis runs in the cloud; you just play.',
  },
];

/* ---------- waitlist options ---------- */
export const INSTRUMENTS = ['Guitar', 'Bass', 'Vocals', 'Keys', 'Drums', 'Other'];
export const SKILL_LEVELS = ['Intermediate', 'Advanced', 'Pro / teaching'];
export const HEARD = ['A friend', 'Reddit / forum', 'YouTube', 'Search', 'Social', 'Other'];

/* ---------- Concierge knowledge base (simulated semantic retrieval) ----------
   Each entry has keywords used to score a query (stand-in for embeddings),
   a short passage "id" for the retrieval chip, and the answer. The Concierge is
   strictly about the product, with a few honest general-music answers. */
export const KB: KbEntry[] = [
  {
    id: 'kb/overview',
    topic: 'What Octave is',
    kw: 'what is octave do product about overview purpose explain summary work works working how learn learning use',
    a: 'Octave turns a recording into a workbench. It separates stems, detects key/tempo/structure, syncs lyrics, and transcribes chords, tab, and notation — then puts it all in one Studio so you can isolate parts, slow things down, loop, and play along.',
  },
  {
    id: 'kb/maestro',
    topic: 'Maestro, the in-app coach',
    kw: 'maestro coach assistant agent ai help guide explain natural language ask question chat studio app in-app inside product voicing pattern',
    a: 'Maestro is the musician-literate coach inside the Studio. Ask it to explain a voicing, name a pattern, walk you through tab, transpose to a new key, or simplify a busy part — all in plain language, anchored to where you are in the song. (Octavia, here on the site, is the concierge; Maestro is the one that plays along inside the app.)',
  },
  {
    id: 'kb/concierge',
    topic: 'Octavia, the site concierge',
    kw: 'octavia concierge you who are this bot site help talking here assistant',
    a: "Octavia — that's me — is the Octave concierge here on the site. I answer what the product does, who it's for, pricing, and the music side of it. The coach that plays along with you inside the Studio is Maestro.",
  },
  {
    id: 'kb/stems',
    topic: 'Stem separation',
    kw: 'stems separate isolate mute solo vocals bass drums guitar parts track split',
    a: "Stem separation splits the mix into parts — vocals, bass, drums, and more — so you can solo the line you're learning or mute the singer. It's how you hear exactly the part you need, with nothing in the way.",
  },
  {
    id: 'kb/transcription',
    topic: 'Transcription accuracy',
    kw: 'transcription accurate accuracy correct chords tab notation midi automatic amt',
    a: 'Automatic transcription gives you chords, tab, and notation good enough to learn from. Structure and chords are reliable; dense or lo-fi mixes are harder. Anything off, you fix in the editor and the correction sticks.',
  },
  {
    id: 'kb/transpose',
    topic: 'Key, tempo, feel',
    kw: 'transpose key change tempo slow speed pitch capo mood feel transposition',
    a: 'You can slow a passage without changing pitch, loop a bar, transpose to fit your voice or capo, and ask Maestro to change the feel. Tell it what you want and it sets up the transport for you.',
  },
  {
    id: 'kb/instruments',
    topic: 'Supported instruments',
    kw: 'instrument support guitar bass vocals keys piano drums what which play',
    a: "Today it's strongest on guitar, bass, vocals, keys, and drums, with the tab and chord work leaning guitar-forward. More instruments and per-part notation arrive through the soft launch.",
  },
  {
    id: 'kb/beginner',
    topic: "Who it's for",
    kw: 'beginner beginners skill level intermediate advanced who for new start novice experienced fit right',
    a: "Octave is built for players who are already past the basics and want to learn real songs faster. If you've never held the instrument, build fundamentals first — this is a bench for taking songs apart, not a first lesson.",
  },
  {
    id: 'kb/upload',
    topic: 'Bringing your own audio',
    kw: 'upload song audio file own catalog where source import bring',
    a: "You bring the audio you own and Octave does the analysis. It's not a streaming catalog — it's the bench you take your own material to.",
  },
  {
    id: 'kb/pricing',
    topic: 'Pricing & access',
    kw: 'price pricing cost free trial subscription pay money plan waitlist access',
    a: "Pricing isn't locked yet. Soft-launch invitees get early access and a say in where it lands. Join the waitlist and we'll bring you in as seats open.",
  },
  {
    id: 'kb/legal',
    topic: 'Rights & legality',
    kw: 'legal copyright rights law allowed legitimate own redistribute host',
    a: "Learning from music you own, for your own practice, is exactly the use we're built for. You're responsible for the rights to what you upload; we don't host or redistribute copyrighted recordings.",
  },
  {
    id: 'kb/theory',
    topic: 'Music theory (general)',
    general: true,
    kw: 'theory chord scale key mode interval progression diatonic circle fifths harmony ii turnaround cadence resolve voicing',
    a: "Happy to talk theory in general terms — a major scale's diatonic chords, a ii–V–I, relative minors, the circle of fifths. Inside the Studio I tie it to the actual song: which chord you're on and why it pulls where it does.",
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
    a: "Automatic music transcription is the task of turning audio into notes — pitches, timing, sometimes fingering. It's hard for dense, polyphonic mixes, which is why Octave pairs it with an editor and Maestro instead of pretending it's perfect.",
  },
];

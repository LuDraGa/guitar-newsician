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

export interface ChatChip {
  icon?: IconName;
  text: string;
  variant?: 'accent' | 'live';
}

export interface MaestroChatTurn {
  role: 'you' | 'maestro';
  text: string;
  /** maestro turns: the music-flavored "working" line shown while he thinks */
  thinking?: string;
  /** when Maestro proposes a move, the CTA in his bubble performs it */
  action?: { label: string; icon: IconName; result: ChatChip[] };
}

export interface MaestroChat {
  id: string;
  label: string;
  turns: MaestroChatTurn[];
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
  tagline: 'Take any song to the musical workstation.',
  // email: 'hello@octave.studio',
  email: 'abhirooprasad@gmail.com',
};

/* ---------- hero (scene 1: the gap) ---------- */
export const HERO = {
  eyebrow: 'For players past the basics',
  // headline is composed in the component so "onto your guitar" can carry the accent
  sub: 'The tab, the voicings, the band: they’re all inside the song. Drop in a recording you own, and Octave gets them out.',
  reassure: 'Soft launch. No spam, just your invite.',
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

/* ---------- the ladder (scene 2: how deep one recording goes) ---------- */
export const JOURNEY = {
  label: 'One song, three depths',
  steps: ['Strum along with the words', 'Pick up the lead lines', 'The whole song on one guitar'],
  coda: 'Maestro coaches every stage.',
};

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
    'Maestro is the personalized AI coach inside the Studio. Ask in plain words. It answers like a musician; and sets up the workstation for you.',
  capture: 'Maestro personalizes to every learner.',
};

/* The transport chips before Maestro has done anything */
export const MAESTRO_BASE_CHIPS: ChatChip[] = [{ text: 'Key B♭' }, { text: '100 bpm' }];

export const MAESTRO_CHATS: MaestroChat[] = [
  {
    id: 'start',
    label: 'Starting out',
    turns: [
      { role: 'you', text: 'Where do I start with this one?' },
      {
        role: 'maestro',
        thinking: 'Reading the changes…',
        text: 'Chords first. Verse and chorus share the same four: G, D, Em, C. I’ve laid the chord chart over the words, so you can sing while you strum.',
      },
      { role: 'you', text: 'The strumming is losing me.' },
      {
        role: 'maestro',
        thinking: 'Counting the strums…',
        text: 'It’s one pattern nearly the whole way: down, down-up, up-down-up. Only the bridge breaks it. Want verse one looped slow so you can lock it in?',
        action: {
          label: 'Loop verse 1 at 0.75×',
          icon: 'loop',
          result: [
            { icon: 'gauge', text: '0.75×' },
            { icon: 'loop', text: 'Verse 1', variant: 'accent' },
            { text: 'Chords over words', variant: 'live' },
          ],
        },
      },
    ],
  },
  {
    id: 'lead',
    label: 'Lead lines',
    turns: [
      { role: 'you', text: 'What’s the riff that opens the song?' },
      {
        role: 'maestro',
        thinking: 'Listening to the intro…',
        text: 'A minor pentatonic, first position. Four notes and a slide, and it comes back after every chorus. The tab is on screen, bar by bar.',
      },
      { role: 'you', text: 'I keep fumbling the slide.' },
      {
        role: 'maestro',
        thinking: 'Watching bars 3 and 4…',
        text: 'Loop bars 3 and 4 at half speed. Index on the 5th fret, slide to the 7th, land on the “and” of beat two. When it sits, bring the tempo back.',
        action: {
          label: 'Loop bars 3 and 4 at 0.5×',
          icon: 'gauge',
          result: [
            { icon: 'gauge', text: '0.5×' },
            { icon: 'loop', text: 'Bars 3 and 4', variant: 'accent' },
            { icon: 'sheet', text: 'Tab on' },
          ],
        },
      },
    ],
  },
  {
    id: 'solo',
    label: 'One guitar',
    turns: [
      { role: 'you', text: 'Can I play this without the band?' },
      {
        role: 'maestro',
        thinking: 'Pulling the stems apart…',
        text: 'Yes. I took the parts apart and wrote a guitar-only arrangement: melody on top, bass notes on the beat. It reads as tab and notation.',
        action: {
          label: 'Open the arrangement',
          icon: 'sheet',
          result: [
            { icon: 'scissors', text: 'Guitar only', variant: 'live' },
            { icon: 'sheet', text: 'Tab + notation' },
          ],
        },
      },
      { role: 'you', text: 'What does my right hand do?' },
      {
        role: 'maestro',
        thinking: 'Checking the fingering…',
        text: 'Thumb owns the bass strings the whole way. Index and middle carry the melody. Bars 9 to 12 are one repeating shape, so learn it once and you have the verse.',
      },
    ],
  },
  {
    id: 'key',
    label: 'Your key',
    turns: [
      { role: 'you', text: 'What’s happening in the chorus?' },
      {
        role: 'maestro',
        thinking: 'Listening to the chorus…',
        text: 'Same four chords as the verse: G, D, Em, C. The lift comes from the strumming, not new chords.',
      },
      { role: 'you', text: 'Put it in a key I can sing.' },
      {
        role: 'maestro',
        thinking: 'Trying keys against your range…',
        text: 'C fits your voice, and capo 2 keeps your open shapes. Want me to move it?',
        action: {
          label: 'Move it to C, capo 2',
          icon: 'wand',
          result: [{ text: 'Key of C · Capo 2', variant: 'live' }],
        },
      },
    ],
  },
  {
    id: 'structure',
    label: 'Structure',
    turns: [
      { role: 'you', text: 'How is this song built?' },
      {
        role: 'maestro',
        thinking: 'Mapping the sections…',
        text: 'Intro, verse, chorus, verse, chorus, bridge, then a double chorus. Seven sections, and the second verse is where the drums get busy. Want markers on the timeline?',
        action: {
          label: 'Mark the sections',
          icon: 'plus',
          result: [
            { text: '7 sections', variant: 'live' },
            { text: 'Markers on', variant: 'accent' },
          ],
        },
      },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    turns: [
      { role: 'you', text: 'I’ve got twenty minutes. What should I work on?' },
      {
        role: 'maestro',
        thinking: 'Finding where you left off…',
        text: 'The pre-chorus push is still rushing. Give it ten minutes at 0.6×, then run the full chorus twice at tempo. I can queue the loops.',
        action: {
          label: 'Queue the loops',
          icon: 'loop',
          result: [
            { icon: 'gauge', text: '0.6×' },
            { icon: 'loop', text: 'Pre-chorus', variant: 'accent' },
            { text: 'Then chorus ×2' },
          ],
        },
      },
      { role: 'you', text: 'And if it still rushes?' },
      {
        role: 'maestro',
        thinking: 'Counting your last takes…',
        text: 'Then we drop to half speed and you clap it before you play it. Rushing lives in the count, not the fingers.',
      },
    ],
  },
  {
    id: 'chord',
    label: 'That chord',
    turns: [
      { role: 'you', text: 'That chord at 1:12 sounds strange. What is it?' },
      {
        role: 'maestro',
        thinking: 'Listening at 1:12…',
        text: 'F♯m7♭5, a half-diminished passing chord: 2 x 2 2 1 x on guitar. It resolves to B7, then E minor. A minor two-five-one.',
        action: {
          label: 'Jump to 1:12',
          icon: 'play',
          result: [
            { icon: 'play', text: '1:12' },
            { icon: 'loop', text: 'Bar 24', variant: 'accent' },
          ],
        },
      },
    ],
  },
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
    'You’ve never held the instrument. Learn the basics first. We’ll be here.',
    'You want karaoke or a streaks game. That’s not this.',
  ],
};

/* ---------- FAQ (scene 4, five questions) ---------- */
export const FAQS: Faq[] = [
  {
    q: 'What does Octave do?',
    a: 'You give it a recording you own. It splits out the parts, finds the key and tempo, syncs the words, and writes out chords, tab, and notation. Then you learn the song piece by piece, and play along.',
  },
  {
    q: 'Is it for beginners?',
    a: 'Not yet. If you can change between open chords and play a simple scale, you’re in. If it’s day one, learn the basics first. Octave will be here.',
  },
  {
    q: 'Which instruments does it cover?',
    a: 'Strongest on guitar, bass, vocals, keys, and drums today. More instruments land through the soft launch.',
  },
  {
    q: 'Do I upload my own music?',
    a: 'Yes. You bring audio you own. There’s no catalog, and we don’t host or share your files. Learning from your own music is the whole point.',
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
    a: 'Octave turns a recording into a workbench. It splits out the parts, finds key, tempo, and structure, syncs the words, and writes out chords, tab, and notation, all in one Studio where you isolate parts, slow things down, loop, and play along.',
  },
  {
    id: 'kb/maestro',
    topic: 'Maestro, the in-app coach',
    kw: 'maestro coach assistant agent ai help guide explain natural language ask question chat studio app in-app inside product voicing pattern',
    a: 'Maestro is the coach inside the Studio. Ask it to explain a voicing, name a pattern, walk you through tab, move a song to a new key, or simplify a busy part. It answers in plain words, anchored to where you are in the song.',
  },
  {
    id: 'kb/concierge',
    topic: 'The site concierge',
    kw: 'octavia concierge you who are this bot site help talking here assistant name',
    a: 'I’m Octavia, the site concierge. I answer what Octave does, who it’s for, and what it’ll cost. Inside the Studio, the coach you’ll actually work with is Maestro.',
  },
  {
    id: 'kb/stems',
    topic: 'Stem separation',
    kw: 'stems separate isolate mute solo vocals bass drums guitar parts track split',
    a: 'Stem separation splits the mix into parts: vocals, bass, drums, and more. Solo the line you’re learning, or mute the singer. You hear exactly the part you need, nothing else.',
  },
  {
    id: 'kb/transcription',
    topic: 'Transcription accuracy',
    kw: 'transcription accurate accuracy correct chords tab notation midi automatic amt',
    a: 'Automatic transcription gives you chords, tab, and notation good enough to learn from. Chords and structure are reliable; dense or lo-fi mixes are harder. Anything off, you fix in the editor, and the fix sticks.',
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
    a: 'Octave is for players past the basics who want to learn real songs faster. If you’ve never held the instrument, learn the fundamentals first. This is a bench for taking songs apart, not a first lesson.',
  },
  {
    id: 'kb/upload',
    topic: 'Bringing your own audio',
    kw: 'upload song audio file own catalog where source import bring',
    a: 'You bring the audio you own and Octave does the analysis. It’s not a streaming catalog. It’s the bench you take your own material to.',
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
    a: 'Happy to talk theory in general terms: a major scale’s diatonic chords, a ii–V–I, relative minors, the circle of fifths. Inside the Studio, Maestro ties it to the actual song: which chord you’re on and why it pulls where it does.',
  },
  {
    id: 'kb/mir',
    topic: 'Music information retrieval (general)',
    general: true,
    kw: 'mir music information retrieval beat tracking key detection onset tempo estimation analysis',
    a: 'Music information retrieval is the field behind a lot of this: beat tracking, key and tempo estimation, chord recognition, structure segmentation. Octave leans on those techniques to turn a waveform into something you can read and play.',
  },
  {
    id: 'kb/amt',
    topic: 'Automatic transcription (general)',
    general: true,
    kw: 'amt automatic music transcription notes pitch detection note tracking polyphonic',
    a: 'Automatic music transcription is the task of turning audio into notes: pitches, timing, sometimes fingering. It’s hard for dense, polyphonic mixes, which is why Octave pairs it with an editor and Maestro instead of pretending it’s perfect.',
  },
];

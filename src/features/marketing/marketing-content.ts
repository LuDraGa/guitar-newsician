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

export interface MaestroBand {
  icon: IconName;
  title: string;
  body: string;
  prompt: string;
}

export interface AccessTrack {
  eyebrow: string;
  title: string;
  body: string;
  source: 'beta' | 'release';
  button: string;
  note: string;
  live?: boolean;
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
  tagline: 'A guitar-first system for turning recordings into structured practice with Maestro.',
  // email: 'hello@octave.studio',
  email: 'abhirooprasad@gmail.com',
};

/* ---------- hero (scene 1: the gap) ---------- */
export const HERO = {
  eyebrow: 'Maestro by Octave',
  sub: 'You know the song by ear. Maestro studies the full recording, finds the musical evidence, and turns it into a structured path toward guitar.',
  reassure: 'Private access. Built slowly for serious players.',
};

/* ---------- songbook (scene 2: three moves) ---------- */
export const BENCH_MOVES: BenchMove[] = [
  {
    n: '01',
    title: 'Bring the recording',
    body: 'Upload audio you own. Octave treats the whole mix as musical context for the guitarist.',
  },
  {
    n: '02',
    title: 'Maestro reads the music',
    body: 'Sections, roles, harmony, rhythm, and confidence become a map instead of a guess.',
  },
  {
    n: '03',
    title: 'Keep the songbook',
    body: 'Stems, chords, tab, lyrics, sheet music, and MIDI stay ready for loops, review, and follow-up questions.',
  },
];

/* ---------- the ladder (scene 2: how deep one recording goes) ---------- */
export const JOURNEY = {
  label: 'One song, one path',
  steps: ['Decode the recording', 'Find the guitar route', 'Grow into the arrangement'],
  coda: 'The evidence stays in your songbook.',
};

/* ---------- songbook (scene 2: what's on it) ---------- */
export const CAPABILITIES: Capability[] = [
  {
    icon: 'scissors',
    tag: 'Stems',
    line: 'Solo the guitar, mute vocals, or hear the rhythm section as the context around your part.',
  },
  {
    icon: 'guitar',
    tag: 'Chords + tab',
    line: 'Playable shapes and lines written over the bars where they belong.',
  },
  {
    icon: 'type',
    tag: 'Lyrics',
    line: 'Words aligned to the music so the form, cues, and chord movement stay connected.',
  },
  {
    icon: 'sheet',
    tag: 'Sheet music',
    line: 'Staff notation for the moments where tab alone is not enough.',
  },
  {
    icon: 'gauge',
    tag: 'MIDI / piano roll',
    line: 'A timing-first view of notes, entrances, and rhythmic density.',
  },
  {
    icon: 'loop',
    tag: 'Loop + tempo',
    line: 'Slow a phrase without changing pitch, then repeat the exact bars that need work.',
  },
];

export const FEEL_TRANSFORM = {
  title: 'Then ask for a different feel.',
  body: 'Once Maestro understands the song, arrangement becomes musical instruction. Ask for the guitar to push a pop track toward a slower blues retreat, keep the vocal contour, and show the voicings that make the mood change believable.',
  chips: ['Pop pulse', 'Blues pocket', 'Single-guitar arrangement'],
};

/* ---------- maestro (scene 3: the coach) ---------- */
export const MAESTRO = {
  title: 'Maestro leads the session.',
  intro:
    'Maestro is the AI music coach inside Octave. It understands the recording as sections, roles, harmony, rhythm, and evidence, then teaches the guitar path proactively: what to learn first, where to loop, when to simplify, and how to grow into the arrangement.',
  capture: 'Structured guidance from the music itself.',
};

export const MAESTRO_BANDS: MaestroBand[] = [
  {
    icon: 'search',
    title: 'Decode the song',
    body: 'Name the form, harmony, tempo, instrument roles, and the moments that make the recording work.',
    prompt: 'Why does that chord feel tense?',
  },
  {
    icon: 'guitar',
    title: 'Find the guitar path',
    body: 'Separate what the guitar should play from everything else happening in the full mix.',
    prompt: 'What should I play first?',
  },
  {
    icon: 'loop',
    title: 'Practice intelligently',
    body: 'Choose the next useful move: simplify a voicing, slow a bar, loop a transition, or explain the count.',
    prompt: 'I have twenty minutes.',
  },
  {
    icon: 'sheet',
    title: 'Arrange the music',
    body: 'Turn chords, melody, bass motion, and fills into a single-guitar version that can grow in difficulty.',
    prompt: 'Can I play this alone?',
  },
  {
    icon: 'wand',
    title: 'Shape the feel',
    body: 'Change the guitar part so the same song can lean brighter, darker, softer, or more blues-driven.',
    prompt: 'Make this feel slower and smoky.',
  },
];

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
        thinking: 'Reading the instrument roles…',
        text: 'Yes. The guitar-only arrangement keeps melody on top and bass notes on the beat. It reads as tab and notation.',
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
    label: 'Capo path',
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
        thinking: 'Checking open-shape options…',
        text: 'Try C with capo 2. It keeps the open shapes friendly and drops the chorus into a more singable guitar register. Want me to move the chart?',
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
        thinking: 'Ranking the hard spots…',
        text: 'Start with the pre-chorus push. Give it ten minutes at 0.6×, then run the full chorus twice at tempo. I can queue those loops.',
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
        thinking: 'Breaking down the count…',
        text: 'Then we drop to half speed and you clap it before you play it. Rushing lives in the count, not the fingers.',
      },
    ],
  },
  {
    id: 'feel',
    label: 'Change the feel',
    turns: [
      { role: 'you', text: 'Can this feel darker and slower on guitar?' },
      {
        role: 'maestro',
        thinking: 'Testing harmony and groove…',
        text: 'Yes. Keep the vocal contour, move the guitar into a slower minor-blues pocket, and let the bass imply the turnaround. The song stays recognizable; the room changes.',
        action: {
          label: 'Open blues arrangement',
          icon: 'wand',
          result: [
            { icon: 'guitar', text: 'Blues guitar', variant: 'live' },
            { icon: 'sheet', text: 'New voicings' },
            { icon: 'loop', text: 'Slow pocket', variant: 'accent' },
          ],
        },
      },
    ],
  },
];

/* ---------- who it's for (scene 4) ---------- */
export const WHO: { forYou: string[]; notYet: string[] } = {
  forYou: [
    'You can change chords, follow tab, and hear when the recording is asking for more than a shape.',
    'You learn by ear, tab, or notation, and want those views lined up with the same recording.',
    'You teach, and want clean song artifacts plus a structured explanation to hand to a student.',
    'You write or arrange, and want to study how a feel, progression, or guitar role works.',
  ],
  notYet: [
    'You are learning how to hold the guitar or make your first chord change. Start with the fundamentals first; Octave will make more sense after that.',
    'You want karaoke, streaks, or a mascot-led lesson game. Octave is a focused music room.',
    'You want real-time grading of your playing. Maestro teaches from the song and your questions today, not from a recording of your performance.',
  ],
};

/* ---------- FAQ (scene 4, five questions) ---------- */
export const FAQS: Faq[] = [
  {
    q: 'What does Octave do?',
    a: 'You give Octave a recording you own. It analyzes the music, separates useful parts, finds structure, aligns lyrics, and creates chords, tab, sheet music, and MIDI or piano-roll views. Maestro uses that same evidence to teach the guitar path through the song.',
  },
  {
    q: 'What is Maestro?',
    a: 'Maestro is the AI music coach inside Octave. It understands the song as music: sections, harmony, rhythm, instrument roles, difficulty, and evidence. It can explain what is happening, choose what to learn first, set up focused practice, and help build a guitar arrangement.',
  },
  {
    q: 'Is it for beginners?',
    a: 'It is for guitar players past the basics. If you can change chords, read some tab, and follow a song form, you are in the right zone. If it is day one, learn the fundamentals first; Octave will be here when real songs start calling.',
  },
  {
    q: 'Does Maestro listen to me play?',
    a: 'Not today. Maestro does not record or grade your performance. The guidance comes from the song analysis and from what you ask, doubt, or want to work on inside the session.',
  },
  {
    q: 'Which instruments does it cover?',
    a: 'Octave studies the full recording because the guitar part only makes sense in context. The public promise is guitar-first: bass, drums, vocals, and keys help Maestro explain the role, rhythm, harmony, and arrangement for the guitarist.',
  },
  {
    q: 'Do I upload my own music?',
    a: 'Yes. You bring audio you own. There’s no catalog, and we don’t host or share your files. Learning from your own music is the whole point.',
  },
  {
    q: 'What will it cost?',
    a: 'Pricing is not final yet. Octave is opening slowly while the product is tuned. Join the shaping track if you want active beta access and feedback loops, or the release track if you want the polished version when it is ready.',
  },
];

/* ---------- final CTA (scene 5) ---------- */
export const FINAL_CTA = {
  eyebrow: 'Private access',
  title: 'Octave is opening slowly.',
  sub: 'Choose the track that fits your relationship to the craft: help shape the beta, or wait for the release-ready room.',
};

export const ACCESS_TRACKS: AccessTrack[] = [
  {
    eyebrow: 'Active beta',
    title: 'I want to shape it.',
    body: 'For players and teachers who are comfortable with rough edges. Test Maestro early, push the songbook surfaces, and give direct feedback while Octave is still being tuned.',
    source: 'beta',
    button: 'Help shape the beta',
    note: 'Best if you want access plus a feedback loop.',
    live: true,
  },
  {
    eyebrow: 'Release track',
    title: 'I just want to play.',
    body: 'For players who want the premium experience when it is ready. Leave your email and we will invite you when Octave is polished enough to become part of your practice.',
    source: 'release',
    button: 'Reserve V1 access',
    note: 'Best if you want the quieter, finished version.',
  },
];

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
    a: 'Octave is a guitar-first system around a recording you own. It analyzes the song, creates stems, chords, tab, lyrics, sheet music, and MIDI or piano-roll views, then Maestro uses that same evidence to teach a structured path toward playing it on guitar.',
  },
  {
    id: 'kb/maestro',
    topic: 'Maestro, the in-app coach',
    kw: 'maestro coach assistant agent ai help guide explain natural language ask question chat studio app in-app inside product voicing pattern',
    a: 'Maestro is the music coach inside Octave. It understands the song as sections, harmony, rhythm, instrument roles, and evidence. Ask it to explain a voicing, choose what to learn first, simplify a busy part, set up a loop, or build toward a guitar arrangement.',
  },
  {
    id: 'kb/concierge',
    topic: 'The site concierge',
    kw: 'octavia concierge you who are this bot site help talking here assistant name',
    a: 'I’m Octavia, the product concierge for this site. I answer questions about Octave, access, fit, and pricing. Inside Octave, the music coach you work with is Maestro.',
  },
  {
    id: 'kb/stems',
    topic: 'Stem separation',
    kw: 'stems separate isolate mute solo vocals bass drums guitar parts track split',
    a: 'Stem separation gives the songbook useful surfaces: vocals, guitar, bass, drums, and more. Solo the guitar, mute vocals, or hear the rhythm section around the part you are learning.',
  },
  {
    id: 'kb/transcription',
    topic: 'Transcription accuracy',
    kw: 'transcription accurate accuracy correct chords tab notation midi automatic amt',
    a: 'Automatic transcription gives you chords, tab, sheet music, and MIDI or piano-roll views to learn from. Dense or lo-fi mixes are harder, so Octave pairs the artifacts with editing and Maestro’s evidence-aware explanations instead of pretending every guess is perfect.',
  },
  {
    id: 'kb/transpose',
    topic: 'Key, tempo, feel',
    kw: 'transpose key change tempo slow speed pitch capo mood feel transposition',
    a: 'You can slow a passage without changing pitch, loop a bar, and move the song for a capo or easier guitar shapes. Maestro can explain the musical tradeoff and set up the next practice move.',
  },
  {
    id: 'kb/instruments',
    topic: 'Supported instruments',
    kw: 'instrument support guitar bass vocals keys piano drums what which play',
    a: 'Octave studies guitar, bass, vocals, keys, drums, and the surrounding mix, but the public promise is guitar-first. Other instruments matter because they explain the harmony, rhythm, and role the guitarist needs to understand.',
  },
  {
    id: 'kb/beginner',
    topic: 'Who it’s for',
    kw: 'beginner beginners skill level intermediate advanced who for new start novice experienced fit right',
    a: 'Octave is for guitar players past the basics: people who can change chords, read some tab, and want real songs explained more deeply. If you have never held the instrument, learn the fundamentals first; Octave will make more sense once songs start calling.',
  },
  {
    id: 'kb/upload',
    topic: 'Bringing your own audio',
    kw: 'upload song audio file own catalog where source import bring',
    a: 'You bring audio you own and Octave analyzes it for your practice. It is not a streaming catalog, and it does not host or redistribute your files.',
  },
  {
    id: 'kb/pricing',
    topic: 'Pricing & access',
    kw: 'price pricing cost free trial subscription pay money plan waitlist access',
    a: 'Pricing is not locked yet. Access is split into two tracks: an active beta for people who want to shape the product with feedback, and a release track for people who want the polished version when it is ready.',
  },
  {
    id: 'kb/legal',
    topic: 'Rights & legality',
    kw: 'legal copyright rights law allowed legitimate own redistribute host',
    a: 'Learning from music you own, for your own practice, is exactly the use Octave is built for. You are responsible for the rights to what you upload; Octave does not host or redistribute copyrighted recordings.',
  },
  {
    id: 'kb/theory',
    topic: 'Music theory (general)',
    general: true,
    kw: 'theory chord scale key mode interval progression diatonic circle fifths harmony ii turnaround cadence resolve voicing',
    a: 'Happy to talk theory in general terms: a major scale’s diatonic chords, a ii–V–I, relative minors, the circle of fifths. Inside Octave, Maestro ties theory to the actual song: which chord you are on and why it pulls where it does.',
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

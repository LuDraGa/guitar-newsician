---
name: WereCode
description: "Turn any song into a workbench: stems, lyrics, MIDI, chords, and structure in one place."
colors:
  rosin: "oklch(0.63 0.135 55)"
  rosin-aged: "oklch(0.42 0.12 50)"
  rosin-soft: "oklch(0.63 0.135 55 / 0.12)"
  verdigris: "oklch(0.62 0.12 165)"
  verdigris-soft: "oklch(0.62 0.12 165 / 0.14)"
  ember: "oklch(0.62 0.15 40)"
  cinnabar: "oklch(0.55 0.16 28)"
  ebony: "oklch(0.205 0.006 60)"
  rosewood: "oklch(0.27 0.008 60)"
  graphite: "oklch(0.52 0.008 65)"
  ash: "oklch(0.66 0.008 70)"
  spruce: "oklch(0.945 0.006 75)"
  spruce-deep: "oklch(0.925 0.007 72)"
  maple: "oklch(0.985 0.004 80)"
  maple-shade: "oklch(0.965 0.005 78)"
  hairline: "oklch(0.205 0.006 60 / 0.16)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "0"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    letterSpacing: "0.12em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  sm: "10px"
  md: "14px"
  lg: "22px"
  pill: "999px"
components:
  pill-primary:
    backgroundColor: "{colors.ebony}"
    textColor: "{colors.spruce}"
    rounded: "{rounded.pill}"
    padding: "0 20px 0 16px"
    height: "44px"
  pill-accent:
    backgroundColor: "{colors.rosin}"
    textColor: "oklch(0.99 0.01 80)"
    rounded: "{rounded.pill}"
    height: "44px"
  pill-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ebony}"
    rounded: "{rounded.pill}"
    height: "44px"
  chip:
    backgroundColor: "{colors.maple-shade}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-live:
    backgroundColor: "{colors.verdigris-soft}"
    textColor: "oklch(0.42 0.1 165)"
    rounded: "{rounded.pill}"
  surface:
    backgroundColor: "{colors.maple}"
    rounded: "{rounded.md}"
  input-search:
    backgroundColor: "{colors.maple}"
    textColor: "{colors.ebony}"
    rounded: "{rounded.pill}"
---

# Design System: WereCode

## 1. Overview

**Creative North Star: "The Luthier's Bench"**

WereCode looks and feels like a stringed-instrument maker's bench: a warm,
pale work surface with exact tools laid out, lit by a low lamp, where the
craft is taken seriously and the noise is kept out. The page is planed
**Spruce** (a warm off-white, `oklch(0.945 0.006 75)`), faintly grained with a
4px dotted texture so it reads as a real surface rather than a flat screen.
Type is set in confident grotesk; numbers are cut in monospace with tabular
figures so a ticking transport never jitters. The single warm accent is
**Rosin** amber, used the way a luthier reaches for one varnish: sparingly, for
the thing that matters right now. A second signal, **Verdigris**, the blue-green
patina of aged brass tuning pegs, means "live / ready / playing."

The tension the system lives on is precision against warmth. The mono,
tabular-numeric transport and the hairline-exact panels earn a musician's
trust; the paper grain, soft warm shadows, and rounded, hand-sized pill
controls lower the intimidation of pulling a song apart. Neither alone is the
brand. A cold, exact tool would feel like a spreadsheet; a warm, fuzzy one
would feel like a toy. WereCode is the warm bench *and* the calipers.

This system explicitly rejects four things, carried verbatim from the product's
anti-references: the **cluttered legacy DAW** (Pro Tools / Ableton
wall-of-knobs density), the **toy / gamified app** (badges, cartoon mascots,
confetti), the **generic AI SaaS** look (purple gradients, glass cards, the
hero-metric template, "supercharge" copy), and the **sterile corporate
dashboard** (cold navy-and-gray data grids). When a choice drifts toward any of
those, it is wrong by definition here.

**Key Characteristics:**
- Light, warm **Spruce** field with a faint dotted-paper grain; never dark mode, never stark white.
- One rare warm accent (**Rosin**), one live signal (**Verdigris**), everything else neutral wood tones.
- Monospace, tabular figures for every time / tempo / count.
- Tactile, rounded controls that lift softly on touch; never flat, never industrial.
- Status is always color **plus** a text label, never color alone.

## 2. Colors

A warm wood-shop palette: pale tonewood surfaces, near-black fingerboard text, a single amber varnish accent, and an aged-brass signal green.

### Primary
- **Rosin** (`oklch(0.63 0.135 55)`): the one warm accent, an amber resin. Marks the single primary action, the focus ring, in-progress state, and small moments of attention. Paired darker as **Aged Rosin** (`oklch(0.42 0.12 50)`) for accent-colored text that must stay legible on light surfaces, and as **Rosin Soft** (`oklch(0.63 0.135 55 / 0.12)`) for tinted accent chips and selection highlights.

### Secondary
- **Verdigris** (`oklch(0.62 0.12 165)`): the blue-green patina of aged brass. The "live / ready / playing" signal: a song that finished processing, a transport that is running, a stem that is audible. **Verdigris Soft** (`oklch(0.62 0.12 165 / 0.14)`) backs the "live" chip.

### Tertiary
- **Ember** (`oklch(0.62 0.15 40)`): warm orange. Warnings and reversible cautions only.
- **Cinnabar** (`oklch(0.55 0.16 28)`): the red lacquer pigment. Destructive and failed states only (delete, failed job).

### Neutral
- **Ebony** (`oklch(0.205 0.006 60)`): the fingerboard wood. Primary text, the logo mark, the dark "pill" and "segment" backgrounds.
- **Rosewood** (`oklch(0.27 0.008 60)`): the lighter dark fretboard wood. Strong secondary text and headings just below the darkest ink.
- **Graphite** (`oklch(0.52 0.008 65)`): pencil marks on the bench. Muted body text, labels, secondary copy. This is the lightest tone permitted for sustained reading; never go fainter for real content.
- **Ash** (`oklch(0.66 0.008 70)`): pale ash tonewood. Placeholder text and the faintest non-essential marks only, never body copy.
- **Spruce** (`oklch(0.945 0.006 75)`): the pale soundboard. The page background, the surface you work on. **Spruce Deep** (`oklch(0.925 0.007 72)`) is the recessed background tone.
- **Maple** (`oklch(0.985 0.004 80)`): pale figured maple that catches the light. Raised cards and panels sit on Maple, lifting off the Spruce field. **Maple Shade** (`oklch(0.965 0.005 78)`) is the resting chip background.
- **Hairline** (`oklch(0.205 0.006 60 / 0.16)`): an ink-derived translucent rule for borders and dividers; lighter `line` / `line-2` variants for quieter separation.

### Named Rules
**The Rosin Rule.** Rosin is varnish, not paint. It appears on the single most important action on a surface, on focus, and on in-progress state, and nowhere else. If two things on screen are Rosin, one of them is wrong. Large Rosin fills are forbidden; the warmth comes from the wood, not from the accent.

**The Two-Signal Rule.** Rosin means "your move / in progress." Verdigris means "live / ready / playing." They are never swapped and never used decoratively. A reader must be able to learn those two meanings once and trust them everywhere.

## 3. Typography

**Display Font:** Schibsted Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Hanken Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, monospace`)

**Character:** A confident geometric grotesk for display paired with a warmer humanist grotesk for reading, with a precise monospace reserved for numbers. The pairing is the brand in miniature: the display face states things plainly, the body face is easy to live in, and the mono face is exact where exactness is the whole point.

### Hierarchy
- **Display** (Schibsted Grotesk 800, `line-height: 0.98`, `letter-spacing: 0`): product name, page titles, the boldest headings. Tight leading; set large but never shouting (cap well under 6rem).
- **Headline** (Hanken Grotesk 700–800): section and panel headings inside the app.
- **Title** (Hanken Grotesk 600): card titles, song titles, control-group headings.
- **Body** (Hanken Grotesk 400–500, `line-height: 1.5`): all reading copy. Cap measure at 65–75ch. Body color is **Ebony** or **Graphite**, never lighter than Graphite.
- **Label** (Hanken Grotesk 650, `11px`, `letter-spacing: 0.12em`, UPPERCASE): the `.label` eyebrow for control groups and metadata keys. Short phrases only (≤4 words).
- **Mono** (JetBrains Mono 500, `font-feature-settings: "tnum"`): every time, tempo, bar/beat, count, duration, and timecode.

### Named Rules
**The Tabular Transport Rule.** Every digit that can change while playing, the playhead time, tempo, bar:beat, counts, is JetBrains Mono with tabular figures (`tnum` / `.tnum`). Proportional numerals in the transport are forbidden; the readout must not reflow as it ticks.

**The Quiet-Eyebrow Rule.** The uppercase `.label` is a metadata key and a control-group label, not a decorative kicker stacked above every section. One per cluster, never a row of them down a page.

## 4. Elevation

The system is softly layered, never flat and never heavy. Raised surfaces rest on a warm, low-contrast ambient shadow; the deeper "pop" shadow is earned, not default, appearing only as a response to hover or active state. Quiet nested surfaces drop shadow entirely and use a hairline inset instead, so depth never stacks card-on-card. All shadows are tinted warm (`oklch(0.2 0.01 60)`), matching the wood, never neutral gray or cold black.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px oklch(0.2 0.01 60 / 0.05), 0 8px 24px oklch(0.2 0.01 60 / 0.06)`): the default for raised cards and panels (`.surface`).
- **Lifted** (`box-shadow: 0 12px 40px oklch(0.2 0.01 60 / 0.16), 0 2px 8px oklch(0.2 0.01 60 / 0.08)`): hover / active / popovers (`.shadow-pop`). The element rises ~1px on hover to meet it.
- **Inset hairline** (`box-shadow: inset 0 0 0 1px var(--line-2)`): the flat `.surface-flat` and nested surfaces; conveys edge without elevation.

### Named Rules
**The Lift-on-Touch Rule.** A surface sits at Resting elevation and only climbs to Lifted as a response to interaction (hover, press, open). Elevation is feedback, not decoration. Nested or secondary surfaces use the inset hairline and cast no shadow at all.

## 5. Components

Controls are tactile and physical: rounded, hand-sized, lifting softly on touch, the way a well-made knob or key feels. Nothing is sharp-cornered or industrial.

### Buttons
- **Shape:** fully rounded pill (`999px`); icon buttons are squircle (`12px`). Standard height 44px, small 36px.
- **Primary:** **Ebony** fill, **Spruce** text, with an optional inset icon "dot" (`.pill .dot`). Padding `0 20px 0 16px`.
- **Accent:** **Rosin** fill with near-white text. Reserved for the single primary action per surface (see The Rosin Rule).
- **Ghost:** transparent with a `1.5px` **Hairline** inset border and **Ebony** text; on hover it gains a Maple background and the Resting shadow.
- **Hover / Focus:** pills lift `translateY(-1px)` into the Lifted shadow over `0.15s ease`. Focus-visible is a `2px` **Rosin** outline at `2px` offset on every interactive element.

### Chips
- **Style:** small pill (`999px`), `Maple Shade` background with a hairline inset, **Graphite** text, `12px` weight 600. Used for tags, readiness flags, and metadata.
- **State / variants:** `on` (Ebony fill, Spruce text), `accent` (Rosin Soft tint, Aged Rosin text), `live` (Verdigris Soft tint, deep Verdigris text), `warn` (Ember tint/text), `danger` (Cinnabar tint/text). Variant color always rides alongside a text label, never alone.

### Cards / Containers
- **Corner Style:** `14px` (`--radius`); large containers `22px`, small `10px`.
- **Background:** **Maple** raised on the **Spruce** field.
- **Shadow Strategy:** Resting by default; nested/secondary use the inset-hairline `.surface-flat` (see Elevation). Never nest a shadowed card inside another shadowed card.
- **Border:** none on raised cards (shadow carries the edge); hairline inset on flat surfaces.
- **Internal Padding:** generous and rhythmic; the app frame is `min(1180px, 100vw - 32px)`, content padded `28px` (16px on mobile).

### Inputs / Fields
- **Style:** pill-shaped (`999px`) **Maple** field with a `1.5px` **Hairline** inset; textareas are `12px`-radius on **Spruce**.
- **Focus:** `2px` **Rosin** outline at `2px` offset (shared focus treatment).
- **Placeholder:** **Ash** only. Real input text is **Ebony**.

### Navigation
- **Style:** a single segmented control (`.segment`), an **Ebony** track holding pill segments. Inactive segments are translucent white text on the track; the active segment is a **Spruce** pill with **Ebony** text.
- **Topbar:** 68px, three-column grid (brand / nav / actions). On mobile it wraps and the segment goes full-width.
- **States:** hover lifts inactive text toward full white; active is the filled Spruce pill.

### Status System (signature)
The status readout is the clearest expression of the a11y stance. `StatusDot` renders a colored dot **and** its text label together: Ready (Verdigris), Processing / Importing (Rosin, pulsing), Queued / Cancelled / Archived / Draft (Ash), Failed (Cinnabar). In-progress states add a slow `pulse`. The dot is never shown without its word.

### CoverArt (signature)
When real artwork is absent, `CoverArt` generates a deterministic cover from a hash of the song id: concentric radial rings over a dark radial-and-linear gradient, hue driven by `--cover-hue`. Every song gets a stable, distinct, on-brand tile instead of a gray placeholder.

## 6. Do's and Don'ts

### Do:
- **Do** keep the page on the warm **Spruce** field with its faint dotted grain. Light mode is the doctrine.
- **Do** spend **Rosin** like varnish: one primary action, focus, and in-progress only (The Rosin Rule).
- **Do** keep the Two-Signal contract: Rosin = "your move / in progress," Verdigris = "live / ready / playing."
- **Do** set every time, tempo, and count in JetBrains Mono with tabular figures (The Tabular Transport Rule).
- **Do** pair every status color with a text label and use `pulse` for in-progress (The Labeled-Status Rule).
- **Do** keep body text at **Ebony** or **Graphite**; treat **Ash** as placeholder-only.
- **Do** let surfaces rest flat-ish and lift softly on touch; warm-tinted shadows only.

### Don't:
- **Don't** build a **cluttered legacy DAW**: no wall-of-knobs density, no gray engineer-only panels. Disclose depth progressively.
- **Don't** make it a **toy / gamified app**: no badges, confetti, cartoon mascots, or Duolingo-style streak theater.
- **Don't** drift to **generic AI SaaS**: no purple gradients, no glass cards, no hero-metric template, no "supercharge / seamless / next-generation" copy.
- **Don't** go **sterile corporate**: no cold navy-and-gray data grids, no soulless density.
- **Don't** rely on color alone to carry meaning (stems, regions, sections, status); always add label, shape, or position.
- **Don't** use gradient text (`background-clip: text`), colored side-stripe borders (`border-left` accents > 1px), or decorative glassmorphism.
- **Don't** put proportional numerals in the transport, or let a ticking readout reflow.
- **Don't** flip to dark mode or a stark `#fff` background; the warmth is the brand.
- **Don't** nest a shadowed card inside another shadowed card; use the inset-hairline flat surface instead.

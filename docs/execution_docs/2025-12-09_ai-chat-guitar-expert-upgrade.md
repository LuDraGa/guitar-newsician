# AI Chat Agent: Guitar Expert System Prompt

**Date**: 2025-12-09
**Status**: ✅ Complete
**Goal**: Transform AI chat agent into a guitar-centric music theory expert

---

## Problem Statement

The AI chat agent in the transcription panel was failing at basic guitar-specific queries because it lacked:
- Music theory expertise (circle of fifths, harmonization, progressions)
- Guitar-specific knowledge (CAGED system, chord voicings, fingerings)
- Transcription/arrangement skills (separating melody/rhythm/bass, fingerstyle arrangements)
- Practical playability considerations

**Result**: Generic responses without actionable guitar advice.

---

## Solution: Enhanced System Prompt

### New AI Agent Persona

**Master Guitar Instructor + Music Theorist with 20+ years experience**

### Core Expertise Added:

1. **Advanced Music Theory**
   - Scales, modes, intervals, chord construction
   - Voice leading and harmonization principles
   - Circle of fifths and key relationships
   - Chord progressions (ii-V-I, I-IV-V, modal interchange)
   - Functional harmony and borrowed chords

2. **Guitar-Specific Mastery**
   - CAGED system (fretboard mapping, moveable chord shapes)
   - Chord voicings and inversions across all positions
   - Practical fingerings for lead, rhythm, and fingerstyle
   - Open vs barre chords, capo applications
   - Alternative tunings (DADGAD, Open D, etc.)

3. **Transcription & Arrangement**
   - Converting MIDI to playable guitar parts
   - Separating polyphonic MIDI into:
     - Melody/lead (for picking)
     - Rhythm (chord progressions)
     - Bass lines
     - Complete fingerstyle arrangements (bass + melody + harmony)
   - Transposing to easier keys or positions
   - Simplifying complex passages for playability

4. **Guitar Techniques**
   - Bends, slides, vibrato, hammer-ons, pull-offs
   - Picking patterns (alternate, sweep, economy)
   - Fingerpicking patterns (Travis picking, classical, flamenco)
   - Strumming patterns and rhythmic variations

---

## Implementation

### File Modified
- `backend/app/api/routes/midi_editor.py`
  - Line 633-687: Enhanced system prompt with guitar expertise
  - Line 693-718: Enhanced user prompt to reinforce guitar perspective

### Key Changes

**Before (Generic Music Theorist):**
```python
system_prompt = """You are an expert music theorist and MIDI analyst.
You can analyze harmonic content, identify patterns, etc."""
```

**After (Guitar Expert):**
```python
system_prompt = """You are a master guitar instructor and music theorist with 20+ years of experience in:
- Advanced music theory (circle of fifths, harmonization, voice leading)
- CAGED system and guitar-specific chord voicings
- Transcription & arrangement (separating melody/rhythm/bass)
- Practical guitar techniques and playability
..."""
```

---

## Benefits

### For Current Use:
- ✅ Accurate chord shape identification (CAGED system)
- ✅ Practical fingering suggestions
- ✅ Music theory explanations with guitar context
- ✅ Playability-focused advice

### For Future Features:
This system prompt aligns perfectly with planned features:

1. **Sheet Music Generation**
   - AI can suggest proper notation for guitar (treble clef, tab staff)
   - Chord diagrams and fingering annotations

2. **Tablature Generation**
   - AI understands fret positions and string choices
   - Can optimize for playability (avoid difficult stretches)

3. **Arrangement Separation**
   - AI can intelligently separate MIDI into:
     - **Melody/Lead**: Single-note lines for picking
     - **Rhythm/Chords**: Chord progressions for strumming
     - **Bass Lines**: Low notes for separate bass part
     - **Fingerstyle**: Combined arrangement for solo guitar

4. **Transposition & Simplification**
   - AI can transpose to easier keys (using circle of fifths)
   - Suggest capo positions
   - Simplify complex voicings

---

## Example Use Cases

### Before (Generic):
**User:** "What chords are in this section?"
**AI:** "The chords are C, G, Am, F"

### After (Guitar Expert):
**User:** "What chords are in this section?"
**AI:** "The progression is C - G - Am - F (I - V - vi - IV in C major). Here's how to play them:
- C: C-shape in open position (x32010)
- G: G-shape in open position (320003)
- Am: E-shape barre at 5th fret or open (x02210)
- F: F-shape barre at 1st fret (133211) or use capo 1 and play E shape

This is a common pop progression. You could also play it higher up using CAGED shapes around the 8th fret for a brighter tone."

---

## Testing Checklist

- [ ] Test basic chord identification
- [ ] Test CAGED system references
- [ ] Test fingering suggestions
- [ ] Test music theory questions (circle of fifths, transposition)
- [ ] Test arrangement separation requests
- [ ] Test fingerstyle arrangement suggestions
- [ ] Verify timestamps are referenced correctly
- [ ] Verify conversational tone is maintained

---

## Future Improvements

### Potential Enhancements:
1. **Add guitar tuning context** to prompts (standard, DADGAD, etc.)
2. **Include fretboard diagrams** in structured_data output
3. **Upgrade to gpt-4o** for complex theory questions (current: gpt-4o-mini)
4. **Add reference materials**: Common chord progressions, scale patterns
5. **Integrate with tab generation**: AI suggests, backend generates actual tab

### Long-term Vision:
The AI agent becomes a **complete guitar assistant** that:
- Analyzes transcriptions
- Suggests arrangements
- Generates notation (sheet music + tabs)
- Provides learning resources
- Helps with songwriting and composition

---

## Status

**Completed**: 2025-12-09
**Ready for**: User testing and feedback
**Next Steps**: Test with real guitar queries and iterate on system prompt based on response quality

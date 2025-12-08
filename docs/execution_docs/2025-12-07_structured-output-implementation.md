# MIDI AI Editor: Structured Output Implementation

**Date**: 2025-12-07
**Status**: ✅ COMPLETE
**Task**: Implement two-stage structured output with typed parameters for MIDI editing AI agents

---

## Problem Statement

The MIDI AI editor was not showing AI responses because:
1. LLM responses were in free-form text
2. `_parse_proposed_changes()` function only handled one hardcoded pattern (missing pitch bends)
3. For any other issue, it returned an empty array
4. Frontend didn't show anything when `proposed_changes` was empty

**Root cause**: The parsing function completely ignored the LLM's rich textual analysis and only checked for one specific condition.

---

## Solution: Two-Stage Structured Output with JSON Schema

Implemented OpenAI's **Structured Outputs API** (`json_schema` method) using LangChain's `.with_structured_output()`:

### **Stage 1: Comparison Agent** → `DiscrepancyAnalysis`
- **Input**: Audio features + MIDI features + user description
- **Output**: Structured analysis with:
  - `summary`: Overall comparison summary
  - `discrepancies`: List of specific issues with severity, type, location
  - `confidence`: Analysis confidence level

### **Stage 2: Editor Agent** → `MIDIEditProposal`
- **Input**: Discrepancy analysis + audio/MIDI details
- **Output**: Structured proposal with:
  - `analysis_summary`: What's wrong and how to fix it
  - `proposed_changes`: List of typed MIDI operations
  - `confidence`: Proposal confidence level

---

## Implementation Details

### 1. **Backend Schemas** (`schemas.py`)

Created Pydantic models with **discriminated unions** for type-safe parameters:

```python
# Individual operation types (each with specific parameters)
class MergeNotesChange(BaseModel):
    type: Literal["merge_notes"] = "merge_notes"
    note_indices: List[int]
    keep_first: bool = True
    description: str
    reasoning: str

class AddPitchBendSequenceChange(BaseModel):
    type: Literal["add_pitch_bend_sequence"] = "add_pitch_bend_sequence"
    start_time: float
    end_time: float
    start_semitones: float
    end_semitones: float
    num_points: int = 10
    description: str
    reasoning: str

# ... (6 total operation types)

# Discriminated union
ProposedChange = Annotated[
    Union[MergeNotesChange, AddPitchBendChange, ...],
    Field(discriminator="type")
]
```

**Operation types**:
1. `merge_notes` - Combine multiple notes into one
2. `add_pitch_bend_sequence` - Add smooth pitch bend (guitar bends, slides)
3. `add_pitch_bend` - Single pitch bend event
4. `modify_note` - Change note properties (pitch, timing, velocity)
5. `add_note` - Add missing note
6. `delete_note` - Remove incorrect note

### 2. **LangGraph Workflow Updates** (`graph.py`)

**Comparison Node**:
```python
structured_llm = self.llm.with_structured_output(
    schema=DiscrepancyAnalysis,
    method="json_schema",  # OpenAI Structured Outputs API
    strict=True            # Guarantee exact schema match
)

analysis: DiscrepancyAnalysis = structured_llm.invoke(messages)
state["discrepancies"] = [d.model_dump() for d in analysis.discrepancies]
```

**Editor Node**:
```python
structured_llm = self.llm.with_structured_output(
    schema=MIDIEditProposal,
    method="json_schema",
    strict=True
)

proposal: MIDIEditProposal = structured_llm.invoke(messages)
state["proposed_changes"] = [c.model_dump() for c in proposal.proposed_changes]
```

**Removed**: Old text parsing functions (`_parse_discrepancies`, `_parse_proposed_changes`)

### 3. **Enhanced Prompts**

Added detailed operation documentation to system prompts:

```
Available operations (choose the appropriate type):

1. **merge_notes**: Merge multiple MIDI notes into one continuous note
   - Use when: Audio shows one sustained note but MIDI has it split
   - Parameters: note_indices, keep_first

2. **add_pitch_bend_sequence**: Add smooth pitch bend over time
   - Use when: Audio shows pitch bend/slide but MIDI doesn't have it
   - Parameters: start_time, end_time, start_semitones, end_semitones, num_points
   - Example: Guitar bend up 2 semitones over 0.5 seconds
...
```

### 4. **Frontend Updates**

**AIEditor.tsx** - Added user-facing documentation:
- Collapsible "What can the AI fix?" guide
- Maps user-friendly language to operation types:
  - "Guitar bend" → `add_pitch_bend_sequence`
  - "Two notes should be one" → `merge_notes`
  - "Note timing is off" → `modify_note`
- Icons for each operation type (🎸, 🎵, ⏱️, ➕, 🗑️)
- Better example prompts

**Type definitions** (`midiEditorService.ts`):
- Added typed parameter interfaces matching backend
- Supports both flattened (new) and nested (old) formats

### 5. **Backwards Compatibility**

Updated approval endpoint to handle both formats:

```python
# New format: flattened (all fields at top level)
# Old format: nested under "parameters" key
if "parameters" in change:
    params = change["parameters"]  # Old format
else:
    params = {k: v for k, v in change.items()
              if k not in ["type", "description", "reasoning"]}  # New format
```

---

## Technical Details: `.with_structured_output()`

### How it works:

```python
# WRONG (doesn't exist):
self.llm.response_format = MySchema  ❌

# CORRECT:
structured_llm = self.llm.with_structured_output(
    schema=MySchema,
    method="json_schema"
)
result: MySchema = structured_llm.invoke(messages)  # Returns Pydantic instance!
```

**Key points**:
1. Returns a **new runnable**, doesn't modify original LLM
2. Output is a **Pydantic instance**, not a message
3. Uses OpenAI's `response_format` parameter internally
4. Guarantees schema match when `strict=True`

**Method options**:
- `"json_schema"`: Best, uses Structured Outputs API (requires gpt-4o/gpt-4o-mini 2024-08+)
- `"function_calling"`: Works with older models, uses tool calling
- `"json_mode"`: Basic JSON output, no validation

---

## Benefits

✅ **No more empty responses**: LLM can now propose any type of edit
✅ **Type safety**: Pydantic validates all parameters before sending to frontend
✅ **Better UX**: Users see clear, actionable changes with explanations
✅ **Extensible**: Easy to add new operation types
✅ **Robust**: LLM forced to return valid JSON matching schema

---

## Testing Checklist

- [ ] Transcribe vocals stem
- [ ] Select section with pitch bend
- [ ] Submit: "This section has a guitar bend"
- [ ] Verify AI proposes `add_pitch_bend_sequence` change
- [ ] Approve and verify MIDI updated
- [ ] Test other operation types:
  - [ ] Merge notes
  - [ ] Modify timing
  - [ ] Add/delete notes

---

## Model Requirements

**Requires**: `gpt-4o-mini` or `gpt-4o` (2024-08-06 or later)

Current config uses `gpt-4o-mini` ✅

---

## Files Modified

**Backend**:
- ✅ `backend/app/editors/midi_agent_editor/agents/schemas.py` (NEW)
- ✅ `backend/app/editors/midi_agent_editor/agents/graph.py`
- ✅ `backend/app/api/routes/midi_editor.py`

**Frontend**:
- ✅ `frontend/src/components/panels/AIEditor.tsx`
- ✅ `frontend/src/services/midiEditorService.ts`

---

## References

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [LangChain with_structured_output](https://docs.langchain.com/oss/python/integrations/chat/openai)
- [Pydantic Discriminated Unions](https://docs.pydantic.dev/latest/concepts/unions/#discriminated-unions)

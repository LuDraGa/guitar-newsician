"""The light Section×Role drill — ticket #4 of the brief-drill lane.

`drill` = the second coaching verb, composed on the shared Comprehension
Graph. It reaches a region's comprehension exclusively through
`ComprehensionGraphService.ensure_current` — a cold region is populated by
`brief`'s formula + judgment first (persisting the brief node: the compounding
win), a warm region recalls with no brief judgment pass — then adds ONE
drill-specific judgment (what to loop, at what tempo, what to focus on)
grounded in the brief node's rows. This module's only inputs are the brief
NODE and the graph service: it never imports the rollup internals, so no
parallel rollup path exists (PRD stories 15/16) by construction.

The exercise node mirrors the brief node's shape (`data + evidence +
confidence + interpretation`) but stays ephemeral: the persisted artifact is
the brief node underneath. Persisting drill output is deferred (S3 / the
map's fog). The judgment pass runs through the harness's shared runner —
extracted at #5 from this module's deliberate mirror of `interpret_skeleton`,
the observed duplication the earned harness was built from.
"""

from __future__ import annotations

from typing import Any, Callable

from maestro_agent.harness import run_judgment

NODE_TYPE = "section_role_drill"

# Practice pedagogy ladder: start well under tempo, step up to full speed.
TEMPO_LADDER_PERCENTS = (60, 75, 90, 100)

DRILL_JUDGMENT_INSTRUCTIONS = """You are Maestro's drill judgment pass — the single interpretation layer over a deterministic practice plan for a guitar learner. The plan is derived from the song's stored Section×Role comprehension.

Respond with ONLY a JSON object, no prose around it:
{"summary": string, "exercises": [{"section_index": int, "focus": string, "steps": [string], "tempo_advice": string, "hedges": [string], "abstentions": [string]}]}

Rules:
- Every exercise must be practicable on a guitar: what to loop (use the plan's loop window), which part(s) to follow (cite the stem_id in parentheses), what to listen or aim for, and how to climb the plan's tempo_ladder in tempo_advice.
- Ground every statement in the plan's rows (focus_parts, chords, brief_context). Do not invent parts, chords, or musical content absent from the plan.
- Where a caution has reason generic_label, hedge explicitly in `hedges` — do not assign lead/rhythm identities the plan cannot support.
- Where a caution carries a flag (unanalyzable/unmeasured_here) or the plan lacks data (e.g. no tempo), say what is unknown and what would resolve it, in `abstentions` — never guess.
- Never fabricate fingerings, voicings, effects, or techniques. If asked-for detail is not derivable, put an abstention that points where to look instead.

Plan:
"""


# --- the drill formula (pure over the brief node) --------------------------------


def build_drill_plan(brief_node: dict[str, Any]) -> dict[str, Any]:
    """The deterministic practice plan — the drill's *formula*.

    Pure over the brief NODE (never the raw pack): per matched section, a loop
    window, the focus parts (active, guitar-role first), the windowed chords,
    and every flagged part passed through as a caution — never dropped. The
    tempo ladder derives from the pack bpm; a missing bpm yields an honest
    caution instead of a fabricated tempo."""
    skeleton = brief_node.get("data") or {}
    bpm = (skeleton.get("tempo") or {}).get("bpm")
    ladder = _tempo_ladder(bpm)
    plan: dict[str, Any] = {
        "song_id": skeleton.get("song_id"),
        "pack_version": skeleton.get("pack_version"),
        "region": brief_node.get("region"),
        "tempo_ladder": ladder,
        "tempo_evidence": "song_fact_pack.tempo",
        "key": skeleton.get("key"),
        "sections": [_section_plan(section) for section in skeleton.get("sections", [])],
    }
    if ladder is None:
        plan["cautions"] = [
            {
                "reason": "no_tempo",
                "note": "The pack carries no bpm — practice tempo cannot be prescribed; set it by ear or from the recording.",
                "evidence": "song_fact_pack.tempo",
            }
        ]
    context = _brief_context(brief_node)
    if context is not None:
        plan["brief_context"] = context
    return plan


def _tempo_ladder(bpm: Any) -> list[dict[str, Any]] | None:
    if not isinstance(bpm, (int, float)) or bpm <= 0:
        return None
    return [
        {"percent": percent, "bpm": round(bpm * percent / 100)}
        for percent in TEMPO_LADDER_PERCENTS
    ]


def _section_plan(section: dict[str, Any]) -> dict[str, Any]:
    parts = section.get("parts", [])
    active = [part for part in parts if part.get("status") == "active"]
    # Guitar-role parts lead the focus; order within each group stays the
    # skeleton's (deterministic — the formula never reorders by judgment).
    focus = [part for part in active if part.get("role") == "guitar"] + [
        part for part in active if part.get("role") != "guitar"
    ]
    chords = (section.get("mix") or {}).get("chords") or {}
    return {
        "section_index": section.get("section_index"),
        "label": section.get("label"),
        "section": section.get("section"),
        "loop": {
            "start_sec": section.get("start_sec"),
            "end_sec": section.get("end_sec"),
            "evidence": "song_fact_pack.sections",
        },
        "chords": chords,
        "focus_parts": [_focus_row(part) for part in focus],
        "cautions": _cautions(parts),
    }


def _focus_row(part: dict[str, Any]) -> dict[str, Any]:
    activity = part.get("activity") or {}
    return {
        "stem_id": part.get("stem_id"),
        "label": part.get("label"),
        "role": part.get("role"),
        "tags": part.get("tags") or [],
        "generic_label": part.get("generic_label"),
        "note_count": activity.get("note_count"),
        "pitch_range": activity.get("pitch_range"),
        "dominant_pitch_classes": activity.get("dominant_pitch_classes") or [],
        "confidence": activity.get("confidence") or "unknown",
        "evidence": activity.get("evidence") or part.get("identity_evidence"),
    }


def _cautions(parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every flagged part passes through — the drill inherits the brief's
    honesty: a part the comprehension cannot support is named, never dropped
    and never guessed at."""
    cautions: list[dict[str, Any]] = []
    for part in parts:
        if part.get("flag"):
            cautions.append(
                {
                    "stem_id": part.get("stem_id"),
                    "label": part.get("label"),
                    "reason": part.get("status"),
                    "note": part.get("flag"),
                    "evidence": part.get("identity_evidence"),
                }
            )
        if part.get("generic_label"):
            cautions.append(
                {
                    "stem_id": part.get("stem_id"),
                    "label": part.get("label"),
                    "reason": "generic_label",
                    "note": "Identity is ambiguous (identical role/label/tags as a peer) — do not assign it a lead/rhythm role.",
                    "evidence": part.get("identity_evidence"),
                }
            )
    return cautions


def _brief_context(brief_node: dict[str, Any]) -> list[dict[str, Any]] | None:
    """The brief judgment's per-section reading, when it succeeded — grounded
    input for the drill judgment. Omitted when unavailable: the deterministic
    plan stands alone."""
    interpretation = brief_node.get("interpretation") or {}
    if interpretation.get("status") != "ok":
        return None
    sections = interpretation.get("sections")
    if not isinstance(sections, list):
        return None
    return [
        {
            "section_index": section.get("section_index"),
            "mix_story": section.get("mix_story"),
            "guitar_focus": section.get("guitar_focus"),
            "hedges": section.get("hedges") or [],
            "abstentions": section.get("abstentions") or [],
        }
        for section in sections
        if isinstance(section, dict)
    ]


# --- the judgment (exactly one LLM pass, injected) --------------------------------


def interpret_plan(
    plan: dict[str, Any],
    judge: Callable[[str], str],
    model: str | None = None,
) -> dict[str, Any]:
    """Run the single drill interpretation pass over the assembled plan — a
    thin wrapper over the harness judgment runner (the shared try/parse/degrade
    shape #5 extracted from this module's deliberate mirror of
    `interpret_skeleton`). `judge` is the injected LLM call so tests stub it;
    a failure never raises — the deterministic plan stays valuable."""
    return run_judgment(DRILL_JUDGMENT_INSTRUCTIONS, plan, judge, model=model, name="drill judgment")


# --- the node (composition) --------------------------------------------------------


def build_drill_node(
    brief_node: dict[str, Any],
    region: str,
    interpret: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    """Assemble the drill node on top of a brief node from the shared graph.

    An unknown-region error node passes through untouched (the brief already
    abstained-and-pointed). `brief_source` is the trace seam proving
    composition: whether the comprehension underneath came `computed_fresh`
    (cold fill) or `graph_recall` (warm — the substrate compounding). The
    drill node itself stays ephemeral; the durable artifact is the brief node
    the graph service persisted underneath."""
    if "error" in brief_node:
        return brief_node
    plan = build_drill_plan(brief_node)
    interpretation = interpret(plan)
    return {
        "node_type": NODE_TYPE,
        "region": brief_node.get("region"),
        "source": "computed_fresh",
        "ephemeral": True,
        "brief_source": brief_node.get("source"),
        "pack_version": brief_node.get("pack_version"),
        "pack_created_at": brief_node.get("pack_created_at"),
        "data": plan,
        "evidence": {
            "source": "comprehension_graph.section_role_brief",
            "per_claim": True,
            "note": "every plan row carries the evidence path of the brief-node claim it derives from",
        },
        # The drill is only as confident as the comprehension it stands on.
        "confidence": brief_node.get("confidence"),
        "interpretation": interpretation,
    }

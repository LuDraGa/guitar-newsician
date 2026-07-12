"""The ephemeral Section×Role brief — the `brief` capability's tracer bullet (#1).

`brief` = formula + judgment (brief-drill PRD): a deterministic Section×Role
rollup over the current fact pack (pure functions, unit-tested, no LLM), plus
exactly ONE LLM interpretation pass over the assembled skeleton — never a list
of natural-language sub-queries. The result is a structured node carrying
`data + evidence + confidence + interpretation`, returned in-memory; the
durable Comprehension Graph store is ticket #2.

Every claim row in the skeleton carries its own evidence path and confidence;
parts the formula cannot analyze are flagged, never dropped; ambiguously
labeled parts (the seed's three untagged "Guitar" stems) are marked so the
judgment hedges instead of inventing a lead/rhythm split.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from maestro_agent.fact_pack import (
    _activity_for_index,
    _filter_range,
    _key_confidence,
    _numeric_confidence,
    _overall_confidence,
)

logger = logging.getLogger("maestro.brief")

NODE_TYPE = "section_role_brief"
DEFAULT_BRIEF_MODEL = "openai/gpt-5.5"
MAX_BRIEF_CHORDS_PER_SECTION = 24

_ARTICLES = ("the ", "a ", "an ")

JUDGMENT_INSTRUCTIONS = """You are Maestro's briefing judgment pass — the single interpretation layer over a deterministic Section×Role skeleton for a guitar learner.

Respond with ONLY a JSON object, no prose around it:
{"summary": string, "sections": [{"section_index": int, "mix_story": string, "guitar_focus": string, "hedges": [string], "abstentions": [string]}]}

Rules:
- mix_story describes what the FULL MIX does in the section; guitar_focus describes what the GUITARIST should play or practice. Never blend the two.
- Ground every statement in the skeleton's rows and cite the stem_id in parentheses when naming a part.
- Where a part row has generic_label=true, hedge explicitly in `hedges` (e.g. which of the identically labeled guitars is lead cannot be determined) — do not invent a lead/rhythm distinction.
- Where a part row is flagged (status unanalyzable/unmeasured_here), say what is unknown and what data would resolve it, in `abstentions` — never guess.
- Do not fabricate detail absent from the skeleton (exact fingerings, voicings, effects, techniques). If asked-for detail is not derivable, put an abstention that points where to look instead.

Skeleton:
"""


# --- node-selection (pure) ----------------------------------------------------


def resolve_region(sections: list[dict[str, Any]], region: str) -> list[dict[str, Any]]:
    """Resolve a region query to the matching sections — pure node-selection.

    A numeric string matches by section index; anything else matches label or
    section kind case-insensitively with a leading article stripped ("the
    chorus" → "chorus"). ALL matches return: a song with two choruses briefs
    both as one region. No match → [] (the tool answers honestly upstream)."""
    query = str(region or "").strip().lower()
    for article in _ARTICLES:
        if query.startswith(article):
            query = query[len(article) :]
            break
    query = query.strip()
    if not query:
        return []
    if query.lstrip("-").isdigit():
        index = int(query)
        return [section for section in sections if section.get("index") == index]
    matched = []
    for section in sections:
        label = str(section.get("label") or "").strip().lower()
        kind = str(section.get("section") or "").strip().lower()
        if query in (label, kind) or (label and query in label):
            matched.append(section)
    return matched


# --- the formula (pure Section×Role rollup) -----------------------------------


def build_brief_skeleton(pack: dict[str, Any], sections: list[dict[str, Any]]) -> dict[str, Any]:
    """The deterministic Section×Role rollup — the brief's *formula*.

    Pure over the fact pack: per section, the mix context (chords in the window,
    key, tempo, dynamics) plus one row per stem. Every stem appears; a part the
    pack cannot analyze is flagged, never dropped. Every claim row carries its
    evidence path and a confidence."""
    stems = pack.get("midi", {}).get("stems", [])
    ambiguous_ids = _ambiguous_stem_ids(stems)
    key = pack.get("key", {}) or {}
    tempo = pack.get("tempo", {}) or {}
    section_entries = [
        _section_entry(pack, section, stems, ambiguous_ids) for section in sections
    ]
    return {
        "song_id": pack.get("song_id"),
        "pack_version": pack.get("version"),
        "key": {
            "teaching_key": key.get("teaching_key"),
            "detected_key": key.get("detected_key"),
            "key_conflict": key.get("key_conflict"),
            "confidence": _key_confidence(key) or "unknown",
            "evidence": "song_fact_pack.key",
        },
        "tempo": {
            "bpm": tempo.get("bpm"),
            "confidence": tempo.get("confidence") or "unknown",
            "evidence": "song_fact_pack.tempo",
        },
        "mix_dynamics": pack.get("mix_dynamics"),
        "generic_label_stem_ids": ambiguous_ids,
        "sections": section_entries,
    }


def _section_entry(
    pack: dict[str, Any],
    section: dict[str, Any],
    stems: list[dict[str, Any]],
    ambiguous_ids: list[str],
) -> dict[str, Any]:
    start = section.get("start_sec")
    end = section.get("end_sec")
    chords = _filter_range(pack.get("chords", {}).get("progression", []), start, end)
    confidences = [c.get("mean_conf") for c in chords if isinstance(c.get("mean_conf"), (int, float))]
    mean_conf = round(sum(confidences) / len(confidences), 6) if confidences else None
    return {
        "section_index": section.get("index"),
        "label": section.get("label"),
        "section": section.get("section"),
        "start_sec": start,
        "end_sec": end,
        "mix": {
            "chords": {
                "progression": chords[:MAX_BRIEF_CHORDS_PER_SECTION],
                "count": len(chords),
                "truncated": len(chords) > MAX_BRIEF_CHORDS_PER_SECTION,
                "mean_conf": mean_conf,
                "confidence": _numeric_confidence(mean_conf, high=0.6, medium=0.35),
                "evidence": "song_fact_pack.chords.progression",
            },
        },
        "parts": [_part_row(stem, section.get("index"), ambiguous_ids) for stem in stems],
    }


def _part_row(stem: dict[str, Any], section_index: Any, ambiguous_ids: list[str]) -> dict[str, Any]:
    stem_id = str(stem.get("stem_id"))
    generic = stem_id in ambiguous_ids
    row: dict[str, Any] = {
        "stem_id": stem_id,
        "label": stem.get("label"),
        "role": stem.get("role"),
        "tags": stem.get("tags") or [],
        "is_drum": bool(stem.get("is_drum")),
        "generic_label": generic,
        "identity_confidence": "low" if generic else "high",
        "identity_evidence": "song_fact_pack.midi.stems[].label/role/tags",
    }
    act = _activity_for_index(stem, section_index)
    analysis = stem.get("analysis") or {}
    analyzed = analysis.get("status") not in (None, "missing")
    if act is not None:
        row["status"] = "active" if act.get("active") else "silent"
        row["activity"] = {
            "note_count": act.get("note_count"),
            "pitch_range": act.get("pitch_range"),
            "mean_velocity": act.get("mean_velocity"),
            "dominant_pitch_classes": act.get("dominant_pitch_classes") or [],
            "confidence": "high",
            "evidence": "song_fact_pack.midi.stems[].activity_by_section",
        }
    elif analyzed:
        row["status"] = "unmeasured_here"
        row["flag"] = "No per-section MIDI activity for this part — whole-stem analysis only; per-section claims are not available."
    else:
        row["status"] = "unanalyzable"
        row["flag"] = "No MIDI and no analysis for this part — it cannot be briefed; do not guess its content."
    if analyzed:
        stem_key = analysis.get("key") or {}
        row["analysis"] = {
            "own_key": stem_key,
            "own_key_confidence": _key_confidence(stem_key) or "unknown",
            "chord_progression_count": analysis.get("chord_progression_count"),
            "dynamics": analysis.get("dynamics"),
            "integrated_loudness": stem.get("integrated_loudness"),
            "confidence": "high",
            "evidence": "song_fact_pack.midi.stems[].analysis",
        }
    return row


def _ambiguous_stem_ids(stems: list[dict[str, Any]]) -> list[str]:
    """Stems whose identity cannot distinguish them from a peer — flagged so the
    judgment hedges instead of inventing a distinction. Two stems collide when
    their whole identity (role, label, tags) is the same: the seed's three
    untagged "Guitar" stems, but also its three "Organ" stems whose only tag
    ("other") just echoes the role. A unique label or a distinguishing tag set
    (e.g. "Lead Guitar" / tags=["solo"]) keeps a part unambiguous."""
    identity_counts: dict[tuple[str, str, tuple[str, ...]], int] = {}
    for stem in stems:
        key = _identity_key(stem)
        identity_counts[key] = identity_counts.get(key, 0) + 1
    return [str(stem.get("stem_id")) for stem in stems if identity_counts[_identity_key(stem)] > 1]


def _identity_key(stem: dict[str, Any]) -> tuple[str, str, tuple[str, ...]]:
    return (
        str(stem.get("role") or "").strip().lower(),
        str(stem.get("label") or "").strip().lower(),
        tuple(sorted(str(tag).strip().lower() for tag in stem.get("tags") or [])),
    )


# --- the judgment (exactly one LLM pass, injected) -----------------------------


def interpret_skeleton(
    skeleton: dict[str, Any],
    judge: Callable[[str], str],
    model: str | None = None,
) -> dict[str, Any]:
    """Run the single interpretation pass over the assembled skeleton.

    `judge` is the injected LLM call (prompt → text) so tests stub it. The
    output is parsed best-effort; a failure never raises — the formula half of
    the node stays valuable, so degradation is explicit and honest."""
    prompt = JUDGMENT_INSTRUCTIONS + json.dumps(skeleton, separators=(",", ":"))
    base: dict[str, Any] = {"kind": "interpretation"}
    if model:
        base["model"] = model
    try:
        raw = judge(prompt)
    except Exception as exc:
        logger.warning("brief judgment pass failed: %s", exc)
        return {**base, "status": "unavailable", "error": str(exc)}
    parsed = _parse_judgment(raw)
    return {**base, "status": "ok", **parsed}


def _parse_judgment(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return {"summary": str(raw or "").strip()}


def make_judgment(model: str) -> Callable[[str], str]:
    """The real judgment callable: one chat completion through the LiteLLM
    chokepoint (so the usage observer prices it into the turn) with the Langfuse
    handler attached (so the pass lands in the turn's trace as `brief-judgment`)."""
    from maestro_agent.llm import make_chat_model
    from maestro_agent.tracing import build_handler

    def judge(prompt: str) -> str:
        chat = make_chat_model(model)
        config: dict[str, Any] = {"run_name": "brief-judgment"}
        handler = build_handler()
        if handler is not None:
            config["callbacks"] = [handler]
        result = chat.invoke(prompt, config=config)
        return _content_text(getattr(result, "content", result))

    return judge


def _content_text(content: Any) -> str:
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") in {"text", "output_text"}:
                parts.append(str(part.get("text", "")))
            elif isinstance(part, str):
                parts.append(part)
        return "\n".join(part for part in parts if part).strip()
    return str(content)


# --- the node (composition) -----------------------------------------------------


def build_brief_node(
    pack: dict[str, Any],
    region: str,
    interpret: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    """Assemble the ephemeral Section×Role brief node for a region.

    No section match → an honest error listing what exists (abstain-and-point,
    never fabricate a region). `source` is the story-14 trace seam: always
    `computed_fresh` here; `graph_recall` arrives with the #2 store."""
    sections = pack.get("sections", [])
    matched = resolve_region(sections, region)
    if not matched:
        return {
            "error": f"No section of this song matches '{region}'.",
            "available_sections": [
                {"index": section.get("index"), "label": section.get("label")} for section in sections
            ],
            "hint": "Ask again with one of the listed section labels or an index.",
        }
    skeleton = build_brief_skeleton(pack, matched)
    interpretation = interpret(skeleton)
    return {
        "node_type": NODE_TYPE,
        "region": {
            "query": region,
            "section_indexes": [section.get("index") for section in matched],
            # MSAF's `label` is a repetition-cluster id ("0.0"), not a name — the
            # human-readable kind lives in `section`, so display prefers it.
            "labels": [section.get("section") or section.get("label") for section in matched],
        },
        "source": "computed_fresh",
        "ephemeral": True,
        "pack_version": pack.get("version"),
        "pack_created_at": pack.get("created_at"),
        "data": skeleton,
        "evidence": {
            "source": "song_fact_pack",
            "per_claim": True,
            "note": "every claim row in data carries its own evidence path",
        },
        "confidence": {
            "overall": _overall_confidence(
                [
                    skeleton["key"]["confidence"],
                    skeleton["tempo"]["confidence"],
                    "low" if skeleton["generic_label_stem_ids"] else "high",
                ]
            ),
            "identity": "low" if skeleton["generic_label_stem_ids"] else "high",
            "per_claim": True,
        },
        "interpretation": interpretation,
    }

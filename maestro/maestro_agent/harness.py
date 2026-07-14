"""The first earned harness seams — ticket #5 of the brief-drill lane.

Extracted from OBSERVED duplication and defects, never speculation (PRD:
"Earned harness (Issue 05)"):

- **Judgment runner.** `drill.interpret_plan` deliberately mirrored
  `brief.interpret_skeleton` (same prompt-assembly → try/parse/degrade shape,
  the private parser imported across modules) — the duplication both module
  docstrings named as #5's extraction point. `run_judgment`, `parse_judgment`,
  and `make_judgment` now live here; the capability modules keep their
  instruction strings and thin wrappers.
- **Grounding.** `ground` stamps dispatch-level provenance on every tool
  response, so a response names its source by construction, not author
  discipline. Deterministic — no timestamps — so byte-identical-repeat
  guarantees hold, and it is applied AFTER graph persistence, so fresh and
  recalled nodes read identically.
- **Router.** `route_message` classifies a learner message (brief / drill /
  freeform) in pure Python; region candidates come only from the song's real
  section vocabulary (the same names `resolve_region` accepts), so extraction
  can never produce an unresolvable region. `route_directive` renders the
  per-turn nudge line. Soft docstring routing has held 100% live — the router
  makes it deterministic and measurable (`trace.router.followed`), and the
  model can still override a wrong classification.
- **Evaluator stub.** `evaluate_node` attaches warning flags to a brief/drill
  node — targeting the defect class that WAS observed live (#4: prose cited
  section indices outside the region). Flags only: never blocks, never
  persisted, recomputed on every recall so checker improvements apply
  retroactively.

Everything here is pure (no LLM, no I/O) except `make_judgment`, the one
LLM-touching judge factory, kept here so the judgment plumbing has one home.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Callable, Iterable

logger = logging.getLogger("maestro.harness")

SOURCE_FACT_PACK = "song_fact_pack"
SOURCE_COMPREHENSION_GRAPH = "comprehension_graph"

INTENT_BRIEF = "brief"
INTENT_DRILL = "drill"
INTENT_FREEFORM = "freeform"

INTENT_TOOLS = {INTENT_BRIEF: "brief_region", INTENT_DRILL: "drill_region"}


# --- the judgment runner (the observed brief↔drill duplication) -----------------


def run_judgment(
    instructions: str,
    payload: dict[str, Any],
    judge: Callable[[str], str],
    model: str | None = None,
    name: str = "judgment",
) -> dict[str, Any]:
    """One capability judgment pass: compact-JSON payload appended to the
    instructions, `judge` (the injected LLM call — tests stub it) invoked once,
    the reply parsed best-effort. A failure never raises: the deterministic
    formula half of a node stays valuable, so degradation is explicit and
    honest (`status: unavailable`)."""
    prompt = instructions + json.dumps(payload, separators=(",", ":"))
    base: dict[str, Any] = {"kind": "interpretation"}
    if model:
        base["model"] = model
    try:
        raw = judge(prompt)
    except Exception as exc:
        logger.warning("%s pass failed: %s", name, exc)
        return {**base, "status": "unavailable", "error": str(exc)}
    return {**base, "status": "ok", **parse_judgment(raw)}


def parse_judgment(raw: str) -> dict[str, Any]:
    """Best-effort parse of a judgment reply: fenced or bare JSON object, else
    the raw text becomes the summary (degradation, not failure)."""
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


def make_judgment(model: str, run_name: str = "brief-judgment") -> Callable[[str], str]:
    """The real judgment callable: one chat completion through the LiteLLM
    chokepoint (so the usage observer prices it into the turn) with the Langfuse
    handler attached (so the pass lands in the turn's trace under `run_name` —
    `brief-judgment` or `drill-judgment`)."""
    from maestro_agent.llm import make_chat_model
    from maestro_agent.tracing import build_handler

    def judge(prompt: str) -> str:
        chat = make_chat_model(model)
        config: dict[str, Any] = {"run_name": run_name}
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


# --- structural grounding (provenance at tool dispatch) --------------------------


def ground(
    payload: Any,
    *,
    tool: str,
    source: str,
    song_id: str | None = None,
) -> Any:
    """Stamp dispatch-level provenance on a tool response — by construction,
    not author discipline. Error responses are tagged too (which tool, which
    song, still matters). Deterministic: no timestamps, so the brief's
    byte-identical-repeat guarantee holds and fresh vs recalled responses read
    identically. Non-dict payloads pass through untouched."""
    if not isinstance(payload, dict):
        return payload
    provenance: dict[str, Any] = {"tool": tool, "source": source}
    if song_id is not None:
        provenance["song_id"] = song_id
    return {**payload, "provenance": provenance}


# --- the router (pure classification + vocabulary-grounded region) ---------------

# Drill wins when both match: a "practice the chorus — walk me through it" ask
# wants the exercise, and the drill composes on the brief anyway.
_DRILL_PATTERNS = (
    r"\bdrills?\b",
    r"\bexercises?\b",
    r"\bpractice\b",
    r"\bpractise\b",
    r"\bpracticing\b",
    r"\bpractising\b",
)

_BRIEF_PATTERNS = (
    r"\bbrief(?:ing)?\b",
    r"\bwalk me through\b",
    r"\bbreak (?:it |this )?down\b",
    r"\bwhat should i play\b",
)


def route_message(message: str, sections: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Classify a learner message → `{intent, region, matched}`. Pure and
    conservative: anything not clearly a brief/drill ask is `freeform` (the
    loop behaves exactly as today). `region` is extracted only against the
    song's real section vocabulary — never free-text guessing."""
    text = str(message or "").lower()
    matched = _first_match(text, _DRILL_PATTERNS)
    intent = INTENT_DRILL if matched else INTENT_FREEFORM
    if not matched:
        matched = _first_match(text, _BRIEF_PATTERNS)
        if matched:
            intent = INTENT_BRIEF
    if intent == INTENT_FREEFORM:
        return {"intent": INTENT_FREEFORM, "region": None, "matched": None}
    return {"intent": intent, "region": extract_region(text, sections), "matched": matched}


def _first_match(text: str, patterns: Iterable[str]) -> str | None:
    for pattern in patterns:
        found = re.search(pattern, text)
        if found:
            return found.group(0)
    return None


def extract_region(text: str, sections: list[dict[str, Any]] | None) -> str | None:
    """Vocabulary-grounded region extraction. Candidates are the pack's section
    kinds/labels (what `resolve_region` accepts) plus an explicit "section N".
    Exactly one distinct candidate present → that region; zero, several, or a
    name/number conflict → None (the nudge then names just the tool — the model
    fills the argument, as it already does reliably)."""
    lowered = str(text or "").lower()
    names = _section_vocabulary(sections)
    hits: list[tuple[int, int, str]] = []
    for name in names:
        for found in re.finditer(rf"\b{re.escape(name)}\b", lowered):
            hits.append((found.start(), found.end(), name))
    # A hit inside a longer hit's span is the shorter word of a compound
    # ("chorus" inside "pre-chorus") — the longer, more specific name wins.
    surviving = {
        name
        for start, end, name in hits
        if not any((s <= start and end <= e) and (s, e) != (start, end) for s, e, _ in hits)
    }
    numeric_match = re.search(r"\bsection\s+(\d+)\b", lowered)
    numeric = numeric_match.group(1) if numeric_match else None
    if numeric is not None and sections is not None:
        if not any(section.get("index") == int(numeric) for section in sections):
            numeric = None
    if surviving and numeric:
        return None  # a name AND an explicit index — ambiguous, don't guess
    if len(surviving) == 1:
        return next(iter(surviving))
    if not surviving and numeric:
        return numeric
    return None


def _section_vocabulary(sections: list[dict[str, Any]] | None) -> set[str]:
    names: set[str] = set()
    for section in sections or []:
        for field in ("section", "label"):
            value = str(section.get(field) or "").strip().lower()
            if value:
                names.add(value)
    return names


def route_directive(route: dict[str, Any]) -> str | None:
    """Render the per-turn nudge line for a brief/drill classification — None
    for freeform (the turn is untouched). Appended to the user message, never
    the cached static prefix. The model can override a wrong guess: the
    directive says "looks like", it does not forbid other tools."""
    intent = route.get("intent")
    tool = INTENT_TOOLS.get(str(intent))
    if tool is None:
        return None
    region = route.get("region")
    if region:
        return (
            f"[router] This looks like a {intent} ask for region '{region}'. "
            f"Call {tool}('{region}') once and answer from its returned node."
        )
    return (
        f"[router] This looks like a {intent} ask. "
        f"Call {tool}(region) once with the asked region and answer from its returned node."
    )


def route_followed(route: dict[str, Any], tool_calls: list[dict[str, Any]] | None) -> bool:
    """Did the turn follow the routed intent? Freeform trivially holds; a
    brief/drill route holds when the routed tool appears in the turn's calls.
    This is the measurement that turns any future mis-route from anecdote into
    evidence."""
    tool = INTENT_TOOLS.get(str(route.get("intent")))
    if tool is None:
        return True
    return any(str(call.get("name")) == tool for call in tool_calls or [])


# --- the evaluator stub (pure runtime check, flags only) --------------------------


def evaluate_node(node: dict[str, Any]) -> dict[str, Any]:
    """Inspect a finished brief/drill node and attach honest warning flags —
    `{status: ok|flagged, flags: [{code, detail}]}`. Never blocks, never edits;
    error nodes (already honest abstentions) are not evaluated. The
    `unknown_section_index` check targets the defect class observed live at #4
    (prose citing section indices outside the region), here at node level."""
    flags: list[dict[str, str]] = []
    interpretation = node.get("interpretation") or {}
    judgment_ok = interpretation.get("status") == "ok"
    if not judgment_ok:
        flags.append(
            {
                "code": "judgment_unavailable",
                "detail": "The interpretation pass failed or is missing — this node is formula-only.",
            }
        )
    if ((node.get("confidence") or {}).get("overall")) == "low":
        flags.append(
            {
                "code": "low_confidence",
                "detail": "Overall confidence is low — treat this node's claims as tentative.",
            }
        )

    entries = _interpretation_entries(node)
    region_indexes = _region_indexes(node)
    unknown = sorted(
        {
            entry.get("section_index")
            for entry in entries
            if isinstance(entry.get("section_index"), int) and entry.get("section_index") not in region_indexes
        }
    )
    if judgment_ok and unknown:
        flags.append(
            {
                "code": "unknown_section_index",
                "detail": f"The interpretation references section index(es) {unknown} outside this region's {sorted(region_indexes)}.",
            }
        )

    hedges = [hedge for entry in entries for hedge in entry.get("hedges") or []]
    abstentions = [item for entry in entries for item in entry.get("abstentions") or []]
    if judgment_ok and _has_ambiguous_parts(node) and not hedges:
        flags.append(
            {
                "code": "unhedged_ambiguity",
                "detail": "Generically labeled twin parts are present but the interpretation carries no hedges.",
            }
        )
    if judgment_ok and _has_flagged_parts(node) and not abstentions:
        flags.append(
            {
                "code": "missing_abstention",
                "detail": "Parts the formula flagged (unanalyzable/unmeasured) are present but the interpretation carries no abstentions.",
            }
        )

    ungrounded = _ungrounded_claims(node)
    if ungrounded:
        flags.append(
            {
                "code": "ungrounded_claim",
                "detail": "Claim row(s) missing an evidence path: " + ", ".join(ungrounded[:5]),
            }
        )
    return {"status": "flagged" if flags else "ok", "flags": flags}


def _interpretation_entries(node: dict[str, Any]) -> list[dict[str, Any]]:
    interpretation = node.get("interpretation") or {}
    key = "exercises" if node.get("node_type") == "section_role_drill" else "sections"
    entries = interpretation.get(key)
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def _region_indexes(node: dict[str, Any]) -> set[int]:
    indexes = (node.get("region") or {}).get("section_indexes") or []
    return {int(index) for index in indexes if index is not None}


def _has_ambiguous_parts(node: dict[str, Any]) -> bool:
    data = node.get("data") or {}
    if node.get("node_type") == "section_role_drill":
        return any(
            caution.get("reason") == "generic_label"
            for section in data.get("sections") or []
            for caution in section.get("cautions") or []
        )
    return bool(data.get("generic_label_stem_ids"))


def _has_flagged_parts(node: dict[str, Any]) -> bool:
    data = node.get("data") or {}
    if node.get("node_type") == "section_role_drill":
        return any(
            caution.get("reason") != "generic_label"
            for section in data.get("sections") or []
            for caution in section.get("cautions") or []
        ) or bool(data.get("cautions"))
    return any(
        part.get("flag")
        for section in data.get("sections") or []
        for part in section.get("parts") or []
    )


def _ungrounded_claims(node: dict[str, Any]) -> list[str]:
    """Regression guard on the by-construction grounding: walk the node's known
    claim rows and name any that lost their evidence path."""
    data = node.get("data") or {}
    missing: list[str] = []
    if node.get("node_type") == "section_role_drill":
        if not data.get("tempo_evidence"):
            missing.append("tempo_evidence")
        for caution in data.get("cautions") or []:
            if not caution.get("evidence"):
                missing.append("cautions[]")
        for index, section in enumerate(data.get("sections") or []):
            if not (section.get("loop") or {}).get("evidence"):
                missing.append(f"sections[{index}].loop")
            for row in section.get("focus_parts") or []:
                if not row.get("evidence"):
                    missing.append(f"sections[{index}].focus_parts[{row.get('stem_id')}]")
            for caution in section.get("cautions") or []:
                if not caution.get("evidence"):
                    missing.append(f"sections[{index}].cautions[{caution.get('stem_id')}]")
        return missing
    for field in ("key", "tempo"):
        if not (data.get(field) or {}).get("evidence"):
            missing.append(field)
    for index, section in enumerate(data.get("sections") or []):
        if not ((section.get("mix") or {}).get("chords") or {}).get("evidence"):
            missing.append(f"sections[{index}].mix.chords")
        for part in section.get("parts") or []:
            if not part.get("identity_evidence"):
                missing.append(f"sections[{index}].parts[{part.get('stem_id')}]")
    return missing

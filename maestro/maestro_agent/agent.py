"""DeepAgents wrapper for the Maestro baseline Q&A agent (ported from the POC).

The wiring, the 7 bounded SongFactPack tools, and the trace extraction port
nearly verbatim. The differences: the model is a LiteLLM-backed chat model
(`maestro_agent.llm`), the tools read the WereCode SongFactPack (per song, not
per BabySlakh track), and per-request usage rides the trace. The POC's
specialist subagent roster is gone — delegation never fired live on any model
(#17), so the agent answers directly with the bounded tools.
"""

from __future__ import annotations

import inspect
import json
import logging
import time
from datetime import UTC, datetime
from typing import Any

from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    create_deep_agent,
    register_harness_profile,
)

from maestro_agent.brief import DEFAULT_BRIEF_MODEL, interpret_skeleton
from maestro_agent.comprehension_graph import ComprehensionGraphService
from maestro_agent.config import Settings
from maestro_agent.drill import build_drill_node, interpret_plan
from maestro_agent.harness import (
    SOURCE_COMPREHENSION_GRAPH,
    SOURCE_FACT_PACK,
    evaluate_node,
    ground,
    make_judgment,
    route_directive,
    route_followed,
    route_message,
)
from maestro_agent.fact_pack import (
    FactPackUnavailable,
    SongFactPackService,
    build_song_overview,
    render_song_overview,
)
from maestro_agent.llm import make_chat_model, normalize_model, usage_observer
from maestro_agent.tracing import build_handler, new_trace_id, set_turn_io, turn_context
from maestro_agent.tracing import flush as flush_traces

logger = logging.getLogger("maestro.agent")

MAX_HISTORY_MESSAGES = 16
MAX_HISTORY_CHARS = 6000

# Per-request model override is dev-only and gated, but we still refuse anything
# that isn't an OpenAI model so a typo can't quietly bill an unexpected provider.
ALLOWED_MODEL_PREFIX = "openai/"

# Every Maestro model is a ChatLiteLLM instance, so all agents resolve to the
# "litellm" harness profile. Without this, DeepAgents auto-adds a general-purpose
# subagent whose `task` tool ships ~1K tokens of schema on every request — dead
# surface here, since delegation fired 0/10 live on both nano and gpt-5.5 (#17).
register_harness_profile(
    "litellm",
    HarnessProfile(general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False)),
)


class ModelNotAllowed(ValueError):
    """Raised when a requested model is outside the permitted set."""


def resolve_model(model: str | None, settings: Settings) -> str:
    """Normalize a requested model (or fall back to the configured default) and
    enforce the allowlist. Always returns the LiteLLM `provider/model` form so it
    doubles as a stable agent-cache key."""
    normalized = normalize_model(model or settings.agent_model)
    if not normalized.startswith(ALLOWED_MODEL_PREFIX):
        raise ModelNotAllowed(f"Unsupported model '{model}'. Only {ALLOWED_MODEL_PREFIX}* models are allowed.")
    return normalized

SYSTEM_PROMPT_TEMPLATE = """You are Maestro, a guitar-learning music coach answering questions about ONE song the learner is studying.

Active song: {song_id}
{overview_block}
Use only the provided SongFactPack tools for this song. The SongFactPack is built from WereCode's stored analysis and per-stem MIDI for the song.

Important behavior:
- Never request raw full analysis JSON. Pull filtered sections, bars, chords, key, MIDI tracks, parts/stems, slices, or transposed previews through the tools.
- For key questions, distinguish detected_key from teaching_key. Prefer teaching_key for learner-facing guidance while preserving detected_key as evidence.
- Stems are the song's parts — each carries its own identity, key, tempo, chords, loudness, and pitch content. The parts roster and the key headline are ALREADY in the seeded overview above: do not call get_stems or get_key just to restate them.
- Scope every answer to the roster: pick the relevant part(s), then drill with get_stem(stem_id) or get_section_activity. Compare parts only when the question asks (e.g. lead vs rhythm guitar); never dump all parts.
- For a per-part or monophonic part's key/harmony, drill the stem and compare its dominant_pitch_classes (per section, on get_section_activity) or pitch_class_profile (whole stem, on get_stem) to the mix chord roots — reconciling teaching vs detected key first. Trust the part's pitch content over a chord label for bass/monophonic parts.
- Be honest about confidence and evidence; music analysis is uncertain and sometimes conflicting. Surface confidence when it is low or the detected and teaching keys disagree.
- Stay guitar-aware: distinguish what the guitar should play from what is happening in the full mix.
- For "brief this section / walk me through the chorus / what should I play in <section>" asks, call brief_region(region) ONCE and answer from its returned node — do not re-derive the rollup by chaining other tools. Present the node's interpretation as interpretation, keep evidence and confidence visible, and hedge wherever the node flags generic labels.
- For "give me a drill / an exercise / how should I practice <section>" asks, call drill_region(region) ONCE and answer from its returned node — the drill already stands on the region's stored brief (a cold region populates it first; do not call brief_region separately). Present the loop window, tempo ladder, and steps practically, and keep the node's hedges and abstentions visible.
- The UI renders Markdown: use compact tables, inline code, and fenced code blocks when they make the answer clearer.
- Keep answers concise, evidence-backed, and practical.
"""

_agent_cache: dict[str, Any] = {}


def create_agent_runner(
    settings: Settings,
    fact_pack: SongFactPackService,
    song_id: str,
    model: str | None = None,
    pack: dict[str, Any] | None = None,
):
    """Create a DeepAgents runnable scoped to one song (and one model).

    The seeded song overview (0.5) is folded into the static `system_prompt` here,
    at creation, so it rides OpenAI's prompt cache instead of being re-sent per turn.
    `pack` is the current fact pack (None when the song has no analysis yet → no
    overview, but a still-functional agent)."""
    chat_model = make_chat_model(model or settings.agent_model)
    tools = _make_tools(fact_pack, song_id, settings)
    return create_deep_agent(
        model=chat_model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT_TEMPLATE.format(song_id=song_id, overview_block=_overview_block(pack)),
        name="song_qna_agent",
    )


def _overview_block(pack: dict[str, Any] | None) -> str:
    """Render the seeded overview for the system prefix, or "" when there is no pack
    yet. Best-effort: a malformed pack must never block agent creation."""
    if not pack:
        return ""
    try:
        return "\n" + render_song_overview(build_song_overview(pack)) + "\n"
    except Exception:
        return ""


def invoke_agent(
    settings: Settings,
    fact_pack: SongFactPackService,
    message: str,
    song_id: str,
    history: list[dict[str, Any]] | None = None,
    model: str | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    if not settings.agent_enabled:
        return {"content": "Agent is disabled by MAESTRO_AGENT_ENABLED=0.", "raw": None}
    resolved_model = resolve_model(model, settings)
    # The current pack seeds the overview baked into the cached system prefix; it
    # also identifies the cache entry (see _agent_cache_key) so a rebuilt pack busts
    # the stale overview. Fetching it here is the same freshness round-trip the tools
    # already pay per call.
    pack = _safe_overview_pack(fact_pack, song_id)
    # Cache per (song, model, pack identity): switching models must not reuse a
    # runner bound to the old model, and a rebuilt pack must not reuse a runner whose
    # prefix baked in the old overview.
    cache_key = _agent_cache_key(song_id, resolved_model, pack)
    agent = _agent_cache.get(cache_key)
    if agent is None:
        agent = create_agent_runner(settings, fact_pack, song_id, resolved_model, pack=pack)
        _agent_cache[cache_key] = agent

    # The harness router (#5): pure classification of the ask, region grounded
    # in the pack's real section vocabulary. A brief/drill route nudges via a
    # per-turn directive line (the cached static prefix is untouched); freeform
    # leaves the turn exactly as before. The model can override a wrong guess.
    route = route_message(message, (pack or {}).get("sections"))
    directive = route_directive(route)
    messages = _build_agent_messages(song_id, message, history or [], directive=directive)
    observer = usage_observer()
    observer.reset()  # isolate this request's calls (and clear any stale in-flight count)

    # Every turn gets a trace id — Langfuse's when enabled, a local uuid otherwise —
    # so feedback rows can key on it regardless of the observability backend.
    trace_id = new_trace_id()
    handler = build_handler()
    config = _invoke_config(handler)
    # pack_version/pack_created_at is also the seam where #1's fresh-vs-graph-recall
    # flag will land (brief-drill PRD story 14) — one more metadata key.
    turn_metadata = {
        key: value
        for key, value in {
            "song_id": song_id,
            "model": resolved_model,
            "pack_version": pack.get("version") if pack else None,
            "pack_created_at": pack.get("created_at") if pack else None,
        }.items()
        if value is not None
    }

    started_at = _now_iso()
    started = time.perf_counter()
    with turn_context(trace_id, session_id=session_id, user_id=user_id, metadata=turn_metadata) as span:
        result = agent.invoke({"messages": messages}, config=config) if config else agent.invoke({"messages": messages})
        content = _last_message_content(result)
        set_turn_io(span, question=message, answer=content)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    usage_records = observer.drain()
    flush_traces()

    usage = usage_observer().summarize(usage_records)
    trace = _agent_trace(result) or {}
    trace.update(
        {
            # followed=False on a brief/drill route is the measurable mis-route
            # signal the router was deferred behind — evidence, not anecdote.
            "router": {
                **route,
                "directive": directive,
                "followed": route_followed(route, trace.get("tool_calls")),
            },
            "trace_id": trace_id,
            "request": {"song_id": song_id, "message": message, "history_messages": len(messages) - 1},
            "model": resolved_model,
            "usage": usage,
            "usage_calls": usage_records,
            "budget": _budget_status(usage.get("cost_usd"), settings.turn_budget_usd),
            "started_at": started_at,
            "finished_at": _now_iso(),
            "elapsed_ms": elapsed_ms,
        }
    )
    if trace["budget"].get("over"):
        logger.warning(
            "turn over budget: spent $%s > limit $%s (song=%s model=%s trace=%s)",
            trace["budget"]["spent_usd"],
            trace["budget"]["limit_usd"],
            song_id,
            resolved_model,
            trace_id,
        )
    return {"content": content, "raw": trace}


def _invoke_config(handler: Any | None) -> dict[str, Any] | None:
    """LangChain config for the turn — None when there is nothing to attach, so
    monkeypatched fakes without a config kwarg keep working."""
    if handler is None:
        return None
    return {"callbacks": [handler]}


def _budget_status(cost_usd: Any, limit_usd: float) -> dict[str, Any]:
    """The soft per-turn cost guard: compare the fenced observer total against
    the configured ceiling. Flags, never blocks. limit<=0 disables; a missing
    cost (unpriced model) can't be judged and reports over=False."""
    enabled = isinstance(limit_usd, (int, float)) and limit_usd > 0
    spent = float(cost_usd) if isinstance(cost_usd, (int, float)) else None
    return {
        "enabled": enabled,
        "limit_usd": round(float(limit_usd), 6) if enabled else None,
        "spent_usd": round(spent, 6) if spent is not None else None,
        "over": bool(enabled and spent is not None and spent > float(limit_usd)),
    }


def _safe_overview_pack(fact_pack: SongFactPackService, song_id: str) -> dict[str, Any] | None:
    """Fetch the current pack to seed the overview and key the agent cache.
    Best-effort: a song with no analysis yet (or any fetch error) yields None → a
    still-functional agent with no seeded overview (the tools degrade on their own)."""
    try:
        return fact_pack.ensure_current(song_id)
    except (FactPackUnavailable, FileNotFoundError):
        return None
    except Exception:
        return None


def _agent_cache_key(song_id: str, resolved_model: str, pack: dict[str, Any] | None) -> str:
    """Cache agents per (song, model, pack identity). The pack identity (version +
    created_at) busts the cached agent when the pack rebuilds — a FACT_PACK_VERSION
    bump or a re-analysis — so the overview baked into the stable system prefix never
    goes stale. No pack (song not analyzed yet) uses a stable 'nopack' sentinel."""
    if not pack:
        return f"{song_id}|{resolved_model}|nopack"
    return f"{song_id}|{resolved_model}|v{pack.get('version')}|{pack.get('created_at')}"


def _build_agent_messages(
    song_id: str,
    message: str,
    history: list[dict[str, Any]],
    directive: str | None = None,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for item in history[-MAX_HISTORY_MESSAGES:]:
        role = str(item.get("role", "")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        messages.append({"role": role, "content": content[:MAX_HISTORY_CHARS]})
    content = f"Active song is {song_id}. User request: {message}"
    if directive:
        # The router's nudge rides the per-turn user message, never the cached
        # static prefix.
        content = f"{content}\n\n{directive}"
    messages.append({"role": "user", "content": content})
    return messages


def _make_tools(fact_pack: SongFactPackService, song_id: str, settings: Settings | None = None):
    query = fact_pack.query(song_id)
    brief_model = getattr(settings, "brief_model", None) or DEFAULT_BRIEF_MODEL

    def _dispatch(tool_name: str, source: str, func, *args: Any) -> dict[str, Any]:
        # The harness grounding seam (#5): every tool response is provenance-
        # stamped at dispatch, so its source rides by construction — the
        # capabilities inherit it without per-capability bookkeeping.
        return ground(_safe_fact_query(func, *args), tool=tool_name, source=source, song_id=song_id)

    def get_sections() -> dict[str, Any]:
        """Return the active song's section boundaries and labels from the SongFactPack."""
        return _dispatch("get_sections", SOURCE_FACT_PACK, query.get_sections)

    def get_bar_grid(start_sec: float | None = None, end_sec: float | None = None) -> dict[str, Any]:
        """Return bars/beats for the active song, optionally filtered to a time range in seconds. meter.source says whether bars come from MIDI time signatures, analysis downbeats, or beat grouping — state that provenance when answering about bars or timing."""
        return _dispatch("get_bar_grid", SOURCE_FACT_PACK, query.get_bar_grid, start_sec, end_sec)

    def get_chords(start_sec: float | None = None, end_sec: float | None = None, limit: int = 64) -> dict[str, Any]:
        """Return a bounded chord progression slice for the active song."""
        return _dispatch("get_chords", SOURCE_FACT_PACK, query.get_chords, start_sec, end_sec, limit)

    def get_key() -> dict[str, Any]:
        """Return detected key, teaching key, key conflict, confidence, and evidence for the active song."""
        return _dispatch("get_key", SOURCE_FACT_PACK, query.get_key)

    def get_midi_tracks() -> dict[str, Any]:
        """Return the mix-level MIDI summary plus a lightweight stem roster (no per-stem MIDI by default). To get one part's full MIDI/notes, call get_stem(stem_id)."""
        return _dispatch("get_midi_tracks", SOURCE_FACT_PACK, query.get_midi_tracks)

    def get_stems() -> dict[str, Any]:
        """Return a lightweight stem/instrument roster (id, label, role, tags, has_midi, has_analysis, loudness). The parts roster (incl. tags) is already in your seeded overview — don't call this to list parts. Use only to refresh the roster live after a song change mid-conversation, or as a fallback if the overview is unavailable."""
        return _dispatch("get_stems", SOURCE_FACT_PACK, query.get_stems)

    def get_stem(stem_id: str) -> dict[str, Any]:
        """Return full detail for ONE stem/part by id: identity, MIDI summary, its own key/tempo/chords/sections, and per-section activity. Includes pitch_class_profile (the part's whole-song pitch-class lean) — compare it to the mix chord roots for monophonic/per-part key and harmony questions. An analyzed part also carries analysis.dynamics (peak/RMS/crest in dBFS, a coarse band) — its own loudness/dynamics, distinct from integrated_loudness (LUFS)."""
        return _dispatch("get_stem", SOURCE_FACT_PACK, query.get_stem, stem_id)

    def get_section_activity(
        section_index: int | None = None,
        start_sec: float | None = None,
        end_sec: float | None = None,
    ) -> dict[str, Any]:
        """Return which stems are active (and a compact per-part summary) in a section, by section_index or a time range. Use for 'what is each instrument doing here / what should the guitar play in this section'. Each active part carries dominant_pitch_classes for that section — compare to the mix chord roots when reconciling a part's key or harmony."""
        return _dispatch(
            "get_section_activity", SOURCE_FACT_PACK, query.get_section_activity, section_index, start_sec, end_sec
        )

    def get_song_slice(start_sec: float, end_sec: float) -> dict[str, Any]:
        """Return sections, bars, chords, key, and tempo overlapping a time range, plus a lightweight roster of the parts (has_midi flags which carry MIDI). Also carries mix_dynamics (whole-mix peak/RMS/crest in dBFS, a coarse band) — global like key/tempo, the same readout for any range. For what each part plays in the range, call get_section_activity; for one part's detail, get_stem(stem_id)."""
        return _dispatch("get_song_slice", SOURCE_FACT_PACK, query.get_song_slice, start_sec, end_sec)

    def transpose_song(semitones: int | None = None, target_key: str | None = None) -> dict[str, Any]:
        """Return a transposed key and chord progression preview for the active song."""
        return _dispatch("transpose_song", SOURCE_FACT_PACK, query.transpose_song, semitones, target_key)

    def brief_region(region: str) -> dict[str, Any]:
        """Brief a region of the song for a guitarist — the Section×Role briefing tool. region is a section label or index (e.g. 'the chorus', 'verse', '3'); all matching sections are briefed together. Runs the deterministic Section×Role rollup over the fact pack plus one interpretation pass, and returns a structured brief node (data + evidence + confidence + interpretation; parts it cannot analyze are flagged, generic labels are hedged). Briefed regions persist in the song's Comprehension Graph: re-asking a warm region serves the stored node (source: graph_recall, no second interpretation pass), and a fact-pack rebuild recomputes it fresh. Call this ONCE for 'brief / walk me through / what should I play in <section>' asks and answer from the node — do not re-derive it by chaining other tools."""

        def _run() -> dict[str, Any]:
            # Built lazily in the tool body — introspection never touches data.
            graph = ComprehensionGraphService(fact_pack)
            judge = make_judgment(brief_model)
            node = graph.ensure_current(
                song_id, region, lambda skeleton: interpret_skeleton(skeleton, judge, model=brief_model)
            )
            return _evaluated(node)

        return _dispatch("brief_region", SOURCE_COMPREHENSION_GRAPH, _run)

    def drill_region(region: str) -> dict[str, Any]:
        """Generate a practice drill for a region of the song — the light Section×Role drill tool. region is a section label or index (e.g. 'the bridge', 'chorus', '3'); all matching sections are drilled together. Composes on the song's Comprehension Graph: the region's stored brief node is recalled (or populated first via the brief's formula + one interpretation pass if the region is cold), then a deterministic practice plan (loop window, tempo ladder, focus parts, cautions) plus one drill interpretation pass produce a structured drill node (data + evidence + confidence + interpretation; brief_source says whether the underlying comprehension was recalled or computed fresh). Grounded in what's actually happening in the region — flagged or ambiguous parts carry cautions, and missing data yields abstentions, never guesses. Call this ONCE for 'drill / exercise / how do I practice <section>' asks and answer from the node — do not chain brief_region or other tools first."""

        def _run() -> dict[str, Any]:
            # Built lazily in the tool body — introspection never touches data.
            graph = ComprehensionGraphService(fact_pack)
            brief_judge = make_judgment(brief_model)
            brief_node = graph.ensure_current(
                song_id, region, lambda skeleton: interpret_skeleton(skeleton, brief_judge, model=brief_model)
            )
            drill_judge = make_judgment(brief_model, run_name="drill-judgment")
            node = build_drill_node(
                brief_node, region, lambda plan: interpret_plan(plan, drill_judge, model=brief_model)
            )
            return _evaluated(node)

        return _dispatch("drill_region", SOURCE_COMPREHENSION_GRAPH, _run)

    return [
        get_sections,
        get_bar_grid,
        get_chords,
        get_key,
        get_midi_tracks,
        get_stems,
        get_stem,
        get_section_activity,
        get_song_slice,
        transpose_song,
        brief_region,
        drill_region,
    ]


def describe_tools(fact_pack: SongFactPackService) -> list[dict[str, Any]]:
    """Introspect the bounded tools (name, docstring, signature) for the UI's
    Tools panel. The closures are built with a placeholder song id and only
    inspected, never invoked, so no song data is read."""
    described: list[dict[str, Any]] = []
    for tool in _make_tools(fact_pack, "_introspect"):
        params: list[dict[str, Any]] = []
        for name, parameter in inspect.signature(tool).parameters.items():
            annotation = parameter.annotation
            type_str = (
                None
                if annotation is inspect.Parameter.empty
                else getattr(annotation, "__name__", None) or str(annotation)
            )
            has_default = parameter.default is not inspect.Parameter.empty
            params.append(
                {
                    "name": name,
                    "type": type_str,
                    "required": not has_default,
                    "default": parameter.default if has_default else None,
                }
            )
        described.append({"name": tool.__name__, "description": (tool.__doc__ or "").strip(), "params": params})
    return described


def _evaluated(node: dict[str, Any]) -> dict[str, Any]:
    """Attach the harness evaluator's verdict (#5) to a finished brief/drill
    node — fresh or recalled — as a NEW dict, never mutating the object the
    graph service persisted. Error nodes (already honest abstentions) pass
    through unevaluated; the verdict is never persisted, so checker
    improvements apply retroactively to every recalled node."""
    if not isinstance(node, dict) or "error" in node:
        return node
    return {**node, "evaluation": evaluate_node(node)}


def _safe_fact_query(func, *args: Any) -> dict[str, Any]:
    try:
        return func(*args)
    except FactPackUnavailable as exc:
        return {"error": str(exc), "missing": "mix_analysis"}
    except FileNotFoundError as exc:
        return {"error": str(exc), "missing": "song_fact_pack"}
    except Exception as exc:
        return {"error": str(exc)}


def _last_message_content(result: Any) -> str:
    messages = result.get("messages") if isinstance(result, dict) else None
    if not messages:
        return str(result)
    last = messages[-1]
    content = getattr(last, "content", None)
    if content is None and isinstance(last, dict):
        content = last.get("content")
    if isinstance(content, list):
        text_parts = [_content_part_to_text(part) for part in content]
        text = "\n".join(part for part in text_parts if part).strip()
        return text or str(content)
    return str(content)


def _content_part_to_text(part: Any) -> str:
    if isinstance(part, dict):
        if part.get("type") in {"text", "output_text"}:
            return str(part.get("text", ""))
        return ""
    return str(part)


def _agent_trace(result: Any) -> dict[str, Any] | None:
    messages = result.get("messages") if isinstance(result, dict) else None
    if not isinstance(messages, list):
        return None
    actions: list[dict[str, Any]] = []
    actions_by_call_id: dict[str, dict[str, Any]] = {}
    tool_calls: list[dict[str, Any]] = []
    model_name = None
    for message in messages:
        calls = getattr(message, "tool_calls", None)
        if calls is None and isinstance(message, dict):
            calls = message.get("tool_calls")
        for call in calls or []:
            if isinstance(call, dict):
                call_id = str(call.get("id") or f"call_{len(actions) + 1}")
                name = str(call.get("name") or "tool")
                args = _parse_json_maybe(call.get("args"))
                kind = "subagent" if name == "task" else "tool"
                display_name = str(args.get("subagent_type") or name) if isinstance(args, dict) else name
                action = {
                    "id": call_id,
                    "kind": kind,
                    "name": display_name,
                    "status": "requested",
                    "request": {"name": name, "args": args},
                    "response": None,
                }
                actions.append(action)
                actions_by_call_id[call_id] = action
                tool_calls.append({"name": name, "args": args})
        tool_call_id = getattr(message, "tool_call_id", None)
        if tool_call_id is None and isinstance(message, dict):
            tool_call_id = message.get("tool_call_id")
        if tool_call_id is not None:
            call_id = str(tool_call_id)
            content = getattr(message, "content", None)
            if content is None and isinstance(message, dict):
                content = message.get("content")
            status = getattr(message, "status", None)
            if status is None and isinstance(message, dict):
                status = message.get("status")
            name = getattr(message, "name", None)
            if name is None and isinstance(message, dict):
                name = message.get("name")
            response = {"name": name, "status": status or "complete", "content": _parse_json_maybe(content)}
            action = actions_by_call_id.get(call_id)
            if action is None:
                action = {
                    "id": call_id,
                    "kind": "tool",
                    "name": str(name or "tool"),
                    "status": "complete",
                    "request": None,
                    "response": response,
                }
                actions.append(action)
                actions_by_call_id[call_id] = action
            else:
                action["status"] = response["status"]
                action["response"] = response
        response_metadata = getattr(message, "response_metadata", None)
        if response_metadata is None and isinstance(message, dict):
            response_metadata = message.get("response_metadata")
        if isinstance(response_metadata, dict):
            model_name = response_metadata.get("model_name") or response_metadata.get("model") or model_name
    final_content = _last_message_content(result)
    if final_content:
        actions.append(
            {
                "id": "final_answer",
                "kind": "final",
                "name": "Final answer",
                "status": "complete",
                "request": None,
                "response": {"content": final_content},
            }
        )
    return {
        "message_count": len(messages),
        "tool_calls": tool_calls,
        "actions": actions,
        "resolved_model": model_name,
    }


def _parse_json_maybe(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return _jsonable(value)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "content") and hasattr(value, "type"):
        return {"type": getattr(value, "type"), "content": getattr(value, "content")}
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)

"""DeepAgents wrapper for the Maestro baseline Q&A agent (ported from the POC).

The wiring, the 7 bounded SongFactPack tools, the 4 specialists, and the trace
extraction port nearly verbatim. The differences: the model is a LiteLLM-backed
chat model (`maestro_agent.llm`), the tools read the WereCode SongFactPack
(per song, not per BabySlakh track), and per-request usage rides the trace.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any

from deepagents import create_deep_agent

from maestro_agent.config import Settings
from maestro_agent.fact_pack import FactPackUnavailable, SongFactPackService
from maestro_agent.llm import make_chat_model, usage_observer

MAX_HISTORY_MESSAGES = 16
MAX_HISTORY_CHARS = 6000

SYSTEM_PROMPT_TEMPLATE = """You are Maestro, a guitar-learning music coach answering questions about ONE song the learner is studying.

Active song: {song_id}

Use only the provided SongFactPack tools for this song. The SongFactPack is built from WereCode's stored analysis and per-stem MIDI for the song.

Important behavior:
- Never request raw full analysis JSON. Pull filtered sections, bars, chords, key, MIDI tracks, slices, or transposed previews through the tools.
- For key questions, distinguish detected_key from teaching_key. Prefer teaching_key for learner-facing guidance while preserving detected_key as evidence.
- Call a specialist subagent only if a focused structure, harmony, rhythm, or MIDI pass would improve the answer.
- Be honest about confidence and evidence; music analysis is uncertain and sometimes conflicting. Surface confidence when it is low or the detected and teaching keys disagree.
- Stay guitar-aware: distinguish what the guitar should play from what is happening in the full mix.
- The UI renders Markdown: use compact tables, inline code, and fenced code blocks when they make the answer clearer.
- Keep answers concise, evidence-backed, and practical.
"""

_agent_cache: dict[str, Any] = {}


def create_agent_runner(settings: Settings, fact_pack: SongFactPackService, song_id: str):
    """Create a DeepAgents runnable scoped to one song."""
    model = make_chat_model(settings.agent_model)
    tools = _make_tools(fact_pack, song_id)
    return create_deep_agent(
        model=model,
        tools=tools,
        subagents=_make_subagents(model),
        system_prompt=SYSTEM_PROMPT_TEMPLATE.format(song_id=song_id),
        name="song_qna_agent",
    )


def invoke_agent(
    settings: Settings,
    fact_pack: SongFactPackService,
    message: str,
    song_id: str,
    history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not settings.agent_enabled:
        return {"content": "Agent is disabled by MAESTRO_AGENT_ENABLED=0.", "raw": None}
    agent = _agent_cache.get(song_id)
    if agent is None:
        agent = create_agent_runner(settings, fact_pack, song_id)
        _agent_cache[song_id] = agent

    messages = _build_agent_messages(song_id, message, history or [])
    observer = usage_observer()
    observer.drain()  # isolate this request's calls
    started_at = _now_iso()
    started = time.perf_counter()
    result = agent.invoke({"messages": messages})
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    usage_records = observer.drain()

    content = _last_message_content(result)
    trace = _agent_trace(result) or {}
    trace.update(
        {
            "request": {"song_id": song_id, "message": message, "history_messages": len(messages) - 1},
            "model": settings.agent_model,
            "usage": usage_observer().summarize(usage_records),
            "usage_calls": usage_records,
            "started_at": started_at,
            "finished_at": _now_iso(),
            "elapsed_ms": elapsed_ms,
        }
    )
    return {"content": content, "raw": trace}


def _build_agent_messages(song_id: str, message: str, history: list[dict[str, Any]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for item in history[-MAX_HISTORY_MESSAGES:]:
        role = str(item.get("role", "")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        messages.append({"role": role, "content": content[:MAX_HISTORY_CHARS]})
    messages.append({"role": "user", "content": f"Active song is {song_id}. User request: {message}"})
    return messages


def _make_tools(fact_pack: SongFactPackService, song_id: str):
    query = fact_pack.query(song_id)

    def get_sections() -> dict[str, Any]:
        """Return the active song's section boundaries and labels from the SongFactPack."""
        return _safe_fact_query(query.get_sections)

    def get_bar_grid(start_sec: float | None = None, end_sec: float | None = None) -> dict[str, Any]:
        """Return bars/beats for the active song, optionally filtered to a time range in seconds."""
        return _safe_fact_query(query.get_bar_grid, start_sec, end_sec)

    def get_chords(start_sec: float | None = None, end_sec: float | None = None, limit: int = 64) -> dict[str, Any]:
        """Return a bounded chord progression slice for the active song."""
        return _safe_fact_query(query.get_chords, start_sec, end_sec, limit)

    def get_key() -> dict[str, Any]:
        """Return detected key, teaching key, key conflict, confidence, and evidence for the active song."""
        return _safe_fact_query(query.get_key)

    def get_midi_tracks() -> dict[str, Any]:
        """Return MIDI track and per-stem summaries for the active song (no audio)."""
        return _safe_fact_query(query.get_midi_tracks)

    def get_song_slice(start_sec: float, end_sec: float) -> dict[str, Any]:
        """Return sections, bars, chords, key, tempo, and MIDI summaries overlapping a time range."""
        return _safe_fact_query(query.get_song_slice, start_sec, end_sec)

    def transpose_song(semitones: int | None = None, target_key: str | None = None) -> dict[str, Any]:
        """Return a transposed key and chord progression preview for the active song."""
        return _safe_fact_query(query.transpose_song, semitones, target_key)

    return [get_sections, get_bar_grid, get_chords, get_key, get_midi_tracks, get_song_slice, transpose_song]


def _make_subagents(model: Any) -> list[dict[str, Any]]:
    return [
        {
            "name": "structure_agent",
            "description": "Use for sections, repeats, intro/verse/chorus-like interpretation, and structure evidence.",
            "model": model,
            "system_prompt": (
                "You are Maestro's structure specialist. Use only SongFactPack tools. "
                "Summarize sections, repeats, and structure evidence without inventing labels when confidence is weak."
            ),
        },
        {
            "name": "harmony_agent",
            "description": "Use for key, chords, cadences, transposition, and chord reliability.",
            "model": model,
            "system_prompt": (
                "You are Maestro's harmony specialist. Use get_key, get_chords, and transpose_song. "
                "Mention confidence and evidence when chord or key estimates are uncertain."
            ),
        },
        {
            "name": "rhythm_agent",
            "description": "Use for BPM, beats, downbeats, bars, timing grid, and rhythm evidence.",
            "model": model,
            "system_prompt": (
                "You are Maestro's rhythm specialist. Use get_bar_grid and get_song_slice. "
                "Always state whether bars come from MIDI time signatures, analysis downbeats, or beat grouping."
            ),
        },
        {
            "name": "midi_agent",
            "description": "Use for MIDI parts, playable phrases, note ranges, instruments, and stem summaries.",
            "model": model,
            "system_prompt": (
                "You are Maestro's MIDI specialist. Use get_midi_tracks and get_song_slice. "
                "Keep findings tied to MIDI channels, programs, pitch ranges, and stems."
            ),
        },
    ]


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

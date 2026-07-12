"""Langfuse tracing for the Maestro agent — the traceability lane's seam.

The LangChain CallbackHandler rides `agent.invoke(config={"callbacks": [...]})`
so the whole DeepAgents run tree (LLM generations, tool calls, specialist hops)
lands as one nested Langfuse trace. Everything here degrades to a no-op when
the Langfuse keys are absent from `maestro/.env` — the agent, the tests, and
local dev all run identically without them.

A trace id is minted for every turn even when Langfuse is disabled: the
feedback table (`werecode.maestro_feedback`) keys user reactions on it, so the
join must exist before the observability backend does.
"""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import contextmanager, nullcontext
from typing import Any

logger = logging.getLogger("maestro.tracing")

FEEDBACK_SCORE_NAME = "user-thumbs"


def langfuse_enabled() -> bool:
    return bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))


def new_trace_id() -> str:
    """A 32-char lowercase hex id. Langfuse's own trace-id format is the same
    shape, so we mint with its helper when enabled (keeps it valid as a real
    trace id) and plain uuid4 hex otherwise."""
    if langfuse_enabled():
        try:
            from langfuse import Langfuse

            return Langfuse.create_trace_id()
        except Exception:  # pragma: no cover - langfuse present but misbehaving
            pass
    return uuid.uuid4().hex


def build_handler() -> Any | None:
    """The LangChain callback handler, or None when Langfuse is disabled."""
    if not langfuse_enabled():
        return None
    try:
        from langfuse.langchain import CallbackHandler

        return CallbackHandler()
    except Exception as exc:
        logger.warning("langfuse handler unavailable: %s", exc)
        return None


@contextmanager
def _turn_span(trace_id: str, *, session_id: str | None, user_id: str | None, metadata: dict[str, Any]):
    # Tracing must never break a turn: any failure entering the span degrades
    # to an untraced turn (span=None), same as when Langfuse is disabled.
    try:
        from langfuse import get_client, propagate_attributes

        client = get_client()
        span_cm = client.start_as_current_observation(
            as_type="span", name="maestro-turn", trace_context={"trace_id": trace_id}
        )
    except Exception as exc:
        logger.warning("langfuse turn span unavailable: %s", exc)
        yield None
        return
    with span_cm as span:
        with propagate_attributes(session_id=session_id, user_id=user_id, metadata=metadata):
            yield span


def turn_context(
    trace_id: str,
    *,
    session_id: str | None = None,
    user_id: str | None = None,
    metadata: dict[str, Any] | None = None,
):
    """Context manager wrapping one chat turn so its run tree lands under
    `trace_id` with session/user grouping. A nullcontext when disabled."""
    if not langfuse_enabled():
        return nullcontext()
    try:
        return _turn_span(trace_id, session_id=session_id, user_id=user_id, metadata=metadata or {})
    except Exception as exc:  # pragma: no cover - defensive: tracing must never break a turn
        logger.warning("langfuse turn context unavailable: %s", exc)
        return nullcontext()


def set_turn_io(span: Any, *, question: str, answer: str) -> None:
    """Best-effort trace-level input/output on the turn span."""
    if span is None:
        return
    try:
        span.set_trace_io(input={"question": question}, output={"answer": answer})
    except Exception as exc:
        logger.warning("langfuse set_trace_io failed: %s", exc)


def flush() -> None:
    """Blocking flush so a Ctrl-C'd local dev service never loses traces.
    Revisit (batch/async) at Modal promotion."""
    if not langfuse_enabled():
        return
    try:
        from langfuse import get_client

        get_client().flush()
    except Exception as exc:
        logger.warning("langfuse flush failed: %s", exc)


def record_feedback_score(trace_id: str, verdict: str, comment: str | None = None) -> bool:
    """Attach a user thumbs verdict to a trace as a Langfuse BOOLEAN score.
    Returns False (never raises) when disabled or the write fails — the durable
    record is the Supabase row; this is the observability-side copy."""
    if not langfuse_enabled():
        return False
    try:
        from langfuse import get_client

        get_client().create_score(
            trace_id=trace_id,
            name=FEEDBACK_SCORE_NAME,
            value=1 if verdict == "up" else 0,
            data_type="BOOLEAN",
            comment=(comment or None),
        )
        get_client().flush()
        return True
    except Exception as exc:
        logger.warning("langfuse feedback score failed: %s", exc)
        return False

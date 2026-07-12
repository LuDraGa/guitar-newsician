"""Maestro LLM client — the single chokepoint for every model call.

All agent + specialist calls go through LiteLLM (via langchain-litellm's
ChatLiteLLM), so we get one place for: token/cost tracking, observability /
instrumentation, and easy provider switching (incl. multi-provider voting in
later slices). Swapping providers is an env change (`MAESTRO_AGENT_MODEL`); the
usage observer is the seam where richer instrumentation (e.g. Langfuse) plugs in.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import litellm
from langchain_litellm import ChatLiteLLM
from litellm.integrations.custom_logger import CustomLogger

logger = logging.getLogger("maestro.llm")


def normalize_model(model: str) -> str:
    """Accept both the langchain `provider:model` and LiteLLM `provider/model`
    forms; LiteLLM wants the slash form."""
    if "/" in model:
        return model
    if ":" in model:
        return model.replace(":", "/", 1)
    return model


class MaestroUsageObserver(CustomLogger):
    """Records model / tokens / cost / latency for every LiteLLM completion.

    LiteLLM fires success callbacks on a background thread, so a `drain()`
    immediately after `agent.invoke()` used to race them and drop the final
    call's usage (observed live in the #7 model duel — recorded costs were
    lower bounds). The in-flight fence closes that: `log_pre_api_call`
    registers each call, the success/failure handlers retire it, and `drain`
    waits for the count to reach zero before snapshotting."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending_changed = threading.Condition(self._lock)
        self._pending = 0
        self._records: list[dict[str, Any]] = []

    def log_pre_api_call(self, model, messages, kwargs) -> None:  # noqa: ANN001
        with self._pending_changed:
            self._pending += 1

    def _retire_pending(self) -> None:
        with self._pending_changed:
            if self._pending > 0:
                self._pending -= 1
            self._pending_changed.notify_all()

    def log_failure_event(self, kwargs, response_obj, start_time, end_time) -> None:  # noqa: ANN001
        self._retire_pending()

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:  # noqa: ANN001
        self.log_success_event(kwargs, response_obj, start_time, end_time)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time) -> None:  # noqa: ANN001
        self._retire_pending()

    def log_success_event(self, kwargs, response_obj, start_time, end_time) -> None:  # noqa: ANN001
        try:
            usage = getattr(response_obj, "usage", None)

            def field(name: str) -> Any:
                if usage is None:
                    return None
                return usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)

            def cached_tokens() -> Any:
                # OpenAI/LiteLLM report prompt-cache hits under
                # prompt_tokens_details.cached_tokens (dict or object form). Surfacing
                # it lets the trace prove the static prefix (system prompt + 0.5
                # overview) is being cached across turns.
                details = field("prompt_tokens_details")
                if details is None:
                    return None
                if isinstance(details, dict):
                    return details.get("cached_tokens")
                return getattr(details, "cached_tokens", None)

            try:
                cost = litellm.completion_cost(completion_response=response_obj)
            except Exception:
                cost = None
            try:
                latency_ms = round((end_time - start_time).total_seconds() * 1000, 1)
            except Exception:
                latency_ms = None

            record = {
                "model": kwargs.get("model"),
                "prompt_tokens": field("prompt_tokens"),
                "cached_tokens": cached_tokens(),
                "completion_tokens": field("completion_tokens"),
                "total_tokens": field("total_tokens"),
                "cost_usd": round(cost, 6) if isinstance(cost, (int, float)) else None,
                "latency_ms": latency_ms,
            }
            with self._lock:
                self._records.append(record)
            logger.info("llm.call %s", record)
        except Exception as exc:  # never let observability break a call
            logger.warning("usage observe failed: %s", exc)
        finally:
            self._retire_pending()

    def reset(self) -> None:
        """Start-of-request isolation: clear stale records AND any in-flight
        count a prior request's timeout left behind, so it can't poison this
        turn's fence."""
        with self._pending_changed:
            self._pending = 0
            self._records.clear()
            self._pending_changed.notify_all()

    def drain(self, wait_pending_s: float = 2.0) -> list[dict[str, Any]]:
        """Snapshot + clear the records, first waiting (bounded) for in-flight
        callbacks so the final completion's usage isn't dropped."""
        deadline = time.monotonic() + max(wait_pending_s, 0.0)
        with self._pending_changed:
            while self._pending > 0:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    logger.warning("usage drain timed out with %d call(s) in flight", self._pending)
                    break
                self._pending_changed.wait(timeout=remaining)
            records = list(self._records)
            self._records.clear()
            return records

    @staticmethod
    def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
        def total(name: str) -> int:
            return sum(int(record.get(name) or 0) for record in records)

        return {
            "calls": len(records),
            "prompt_tokens": total("prompt_tokens"),
            "cached_tokens": total("cached_tokens"),
            "completion_tokens": total("completion_tokens"),
            "total_tokens": total("total_tokens"),
            "cost_usd": round(sum(float(record.get("cost_usd") or 0) for record in records), 6),
        }


_observer = MaestroUsageObserver()
_initialized = False


def _init_litellm() -> None:
    global _initialized
    if _initialized:
        return
    if _observer not in (litellm.callbacks or []):
        litellm.callbacks = [*(litellm.callbacks or []), _observer]
    _initialized = True


def make_chat_model(model: str, *, temperature: float = 1.0) -> ChatLiteLLM:
    """Build a LiteLLM-backed chat model for DeepAgents to consume.

    Temperature defaults to 1.0: GPT-5 / o-series reasoning models reject any
    other value, and 1.0 is valid everywhere. Per-model temperature policy can
    live here later (this is the single LLM chokepoint)."""
    _init_litellm()
    return ChatLiteLLM(model=normalize_model(model), temperature=temperature)


def usage_observer() -> MaestroUsageObserver:
    return _observer

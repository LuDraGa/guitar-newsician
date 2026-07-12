"""Traceability lane (map ticket #8) — Langfuse wiring, budget guard, feedback.

Seam A: pure pieces (budget status, trace-id minting, disabled-path tracing
helpers, the observer's in-flight fence). Seam B: `invoke_agent` with a fake
runner (no live LLM) — the trace carries `trace_id` + `budget`, and the
callback handler rides the invoke config only when Langfuse is configured.
No test ever talks to Langfuse or OpenAI.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from maestro_agent import tracing
from maestro_agent import agent as agent_mod
from maestro_agent.agent import _budget_status, invoke_agent
from maestro_agent.config import Settings
from maestro_agent.llm import MaestroUsageObserver


def _clear_langfuse_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)


# ---- Seam A: budget status ---------------------------------------------------


def test_budget_over_when_cost_exceeds_limit():
    status = _budget_status(0.75, 0.50)
    assert status == {"enabled": True, "limit_usd": 0.5, "spent_usd": 0.75, "over": True}


def test_budget_under_when_cost_within_limit():
    status = _budget_status(0.01, 0.50)
    assert status["over"] is False
    assert status["enabled"] is True


def test_budget_disabled_when_limit_zero():
    status = _budget_status(9.99, 0.0)
    assert status == {"enabled": False, "limit_usd": None, "spent_usd": 9.99, "over": False}


def test_budget_cannot_judge_missing_cost():
    status = _budget_status(None, 0.50)
    assert status["spent_usd"] is None
    assert status["over"] is False


# ---- Seam A: tracing helpers degrade cleanly without Langfuse ----------------


def test_trace_id_is_32_hex_without_langfuse(monkeypatch: pytest.MonkeyPatch):
    _clear_langfuse_env(monkeypatch)
    trace_id = tracing.new_trace_id()
    assert len(trace_id) == 32
    int(trace_id, 16)  # raises if not hex


def test_langfuse_disabled_paths(monkeypatch: pytest.MonkeyPatch):
    _clear_langfuse_env(monkeypatch)
    assert tracing.langfuse_enabled() is False
    assert tracing.build_handler() is None
    assert tracing.record_feedback_score("abc123", "up", "note") is False
    with tracing.turn_context("abc123", session_id="conv", user_id="user") as span:
        assert span is None
    tracing.set_turn_io(None, question="q", answer="a")  # no-op, must not raise
    tracing.flush()  # no-op, must not raise


def test_langfuse_enabled_requires_both_keys(monkeypatch: pytest.MonkeyPatch):
    _clear_langfuse_env(monkeypatch)
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    assert tracing.langfuse_enabled() is False
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    assert tracing.langfuse_enabled() is True


# ---- Seam A: the observer's in-flight fence ----------------------------------


class _Usage:
    prompt_tokens = 100
    completion_tokens = 20
    total_tokens = 120
    prompt_tokens_details = None


class _Response:
    usage = _Usage()


def _success(observer: MaestroUsageObserver) -> None:
    start = datetime(2026, 1, 1)
    observer.log_success_event({"model": "openai/test"}, _Response(), start, start + timedelta(milliseconds=10))


def test_drain_waits_for_in_flight_callback():
    """The #7 failure mode: LiteLLM's success callback lands on a background
    thread after invoke() returns. The fence makes drain wait for it."""
    observer = MaestroUsageObserver()
    observer.log_pre_api_call("openai/test", [], {})

    def late_success():
        time.sleep(0.15)
        _success(observer)

    thread = threading.Thread(target=late_success)
    thread.start()
    records = observer.drain(wait_pending_s=2.0)
    thread.join()
    assert len(records) == 1  # without the fence this was []


def test_drain_times_out_on_stuck_pending():
    observer = MaestroUsageObserver()
    observer.log_pre_api_call("openai/test", [], {})  # never retired
    started = time.monotonic()
    records = observer.drain(wait_pending_s=0.1)
    assert records == []
    assert time.monotonic() - started < 1.0  # bounded, no deadlock


def test_reset_clears_stale_pending_and_records():
    observer = MaestroUsageObserver()
    observer.log_pre_api_call("openai/test", [], {})
    _success(observer)
    observer.log_pre_api_call("openai/test", [], {})  # stale in-flight
    observer.reset()
    records = observer.drain(wait_pending_s=0.1)
    assert records == []  # nothing carried over, no timeout wait either


def test_failure_event_retires_pending():
    observer = MaestroUsageObserver()
    observer.log_pre_api_call("openai/test", [], {})
    observer.log_failure_event({}, None, None, None)
    assert observer.drain(wait_pending_s=0.1) == []


# ---- Seam B: invoke_agent trace shape ----------------------------------------


class _FakeAgent:
    def __init__(self) -> None:
        self.invoke_args: list[tuple] = []

    def invoke(self, payload, config=None):  # noqa: ANN001
        self.invoke_args.append((payload, config))
        return {"messages": [{"role": "assistant", "content": "the answer"}]}


class _FakeFactPack:
    def ensure_current(self, song_id: str) -> dict:
        return {"version": 6, "created_at": "2026-07-12T00:00:00Z"}


def _settings(**overrides) -> Settings:
    defaults = dict(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="test-key",
        werecode_schema="werecode",
        sources_bucket="sources",
        artifacts_bucket="artifacts",
        agent_model="openai/gpt-test",
        agent_enabled=True,
    )
    defaults.update(overrides)
    return Settings(**defaults)


@pytest.fixture()
def fake_agent(monkeypatch: pytest.MonkeyPatch) -> _FakeAgent:
    _clear_langfuse_env(monkeypatch)
    fake = _FakeAgent()
    monkeypatch.setattr(agent_mod, "create_agent_runner", lambda *args, **kwargs: fake)
    monkeypatch.setattr(agent_mod, "_agent_cache", {})
    return fake


def test_invoke_agent_trace_carries_trace_id_and_budget(fake_agent: _FakeAgent):
    result = invoke_agent(_settings(), _FakeFactPack(), "how loud?", "song-1", session_id="conv-1", user_id="user-1")
    raw = result["raw"]
    assert len(raw["trace_id"]) == 32
    int(raw["trace_id"], 16)
    # No usage records (fake agent makes no LLM calls) → cost 0, under budget.
    assert raw["budget"]["enabled"] is True
    assert raw["budget"]["limit_usd"] == 0.5
    assert raw["budget"]["over"] is False
    assert result["content"] == "the answer"


def test_invoke_agent_without_langfuse_passes_no_config(fake_agent: _FakeAgent):
    invoke_agent(_settings(), _FakeFactPack(), "q", "song-1")
    payload, config = fake_agent.invoke_args[0]
    assert config is None
    assert payload["messages"][-1]["role"] == "user"


def test_invoke_agent_attaches_handler_when_langfuse_configured(
    fake_agent: _FakeAgent, monkeypatch: pytest.MonkeyPatch
):
    sentinel = object()
    monkeypatch.setattr(agent_mod, "build_handler", lambda: sentinel)
    invoke_agent(_settings(), _FakeFactPack(), "q", "song-1")
    _, config = fake_agent.invoke_args[0]
    assert config == {"callbacks": [sentinel]}


def test_invoke_agent_flags_over_budget_turn(fake_agent: _FakeAgent, monkeypatch: pytest.MonkeyPatch):
    class _CostlyObserver:
        def reset(self) -> None: ...

        def drain(self, wait_pending_s: float = 2.0) -> list[dict]:
            return [{"model": "openai/gpt-test", "cost_usd": 0.9, "total_tokens": 10}]

        @staticmethod
        def summarize(records: list[dict]) -> dict:
            return {"calls": 1, "cost_usd": 0.9, "total_tokens": 10}

    monkeypatch.setattr(agent_mod, "usage_observer", lambda: _CostlyObserver())
    result = invoke_agent(_settings(turn_budget_usd=0.5), _FakeFactPack(), "q", "song-1")
    budget = result["raw"]["budget"]
    assert budget["over"] is True
    assert budget["spent_usd"] == 0.9


# ---- Seam C: the /feedback route delegates to tracing ------------------------


def test_feedback_route_records_score(monkeypatch: pytest.MonkeyPatch):
    from maestro_agent.app import create_app

    captured: dict = {}

    def fake_record(trace_id: str, verdict: str, comment=None) -> bool:  # noqa: ANN001
        captured.update({"trace_id": trace_id, "verdict": verdict, "comment": comment})
        return True

    monkeypatch.setattr(tracing, "record_feedback_score", fake_record)
    client = TestClient(create_app(_settings()))
    response = client.post("/feedback", json={"trace_id": "abc123", "verdict": "down", "comment": "wrong key"})
    assert response.status_code == 200
    assert response.json() == {"ok": True, "langfuse_recorded": True}
    assert captured == {"trace_id": "abc123", "verdict": "down", "comment": "wrong key"}


def test_feedback_route_rejects_bad_verdict():
    from maestro_agent.app import create_app

    client = TestClient(create_app(_settings()))
    response = client.post("/feedback", json={"trace_id": "abc123", "verdict": "meh"})
    assert response.status_code == 422

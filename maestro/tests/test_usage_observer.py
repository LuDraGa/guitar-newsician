"""0.5 — the usage observer surfaces prompt-cache hits.

Seam B: `MaestroUsageObserver` is exercised directly with a fake LiteLLM response
(no live LLM). The point is that `cached_tokens` (OpenAI's
`prompt_tokens_details.cached_tokens`) flows into the per-call record and the
summary, so the Runtime trace can prove the static prefix is being cached.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from maestro_agent.llm import MaestroUsageObserver


class _Usage:
    """LiteLLM-style usage with cached tokens under prompt_tokens_details."""

    def __init__(self, *, details) -> None:  # noqa: ANN001
        self.prompt_tokens = 1500
        self.completion_tokens = 200
        self.total_tokens = 1700
        self.prompt_tokens_details = details


class _Response:
    def __init__(self, *, details) -> None:  # noqa: ANN001
        self.usage = _Usage(details=details)


def _log(observer: MaestroUsageObserver, response: _Response) -> dict:
    start = datetime(2026, 1, 1, 0, 0, 0)
    end = start + timedelta(milliseconds=500)
    observer.log_success_event({"model": "openai/gpt-5.4"}, response, start, end)
    records = observer.drain()
    assert len(records) == 1
    return records[0]


def test_observer_records_cached_tokens_from_dict_details():
    record = _log(MaestroUsageObserver(), _Response(details={"cached_tokens": 1280}))
    assert record["cached_tokens"] == 1280
    assert record["prompt_tokens"] == 1500
    assert record["completion_tokens"] == 200


def test_observer_records_cached_tokens_from_object_details():
    class _Details:
        cached_tokens = 1024

    record = _log(MaestroUsageObserver(), _Response(details=_Details()))
    assert record["cached_tokens"] == 1024


def test_observer_cached_tokens_none_when_details_absent():
    record = _log(MaestroUsageObserver(), _Response(details=None))
    assert record["cached_tokens"] is None


def test_summarize_totals_cached_tokens():
    summary = MaestroUsageObserver.summarize(
        [
            {"prompt_tokens": 1500, "cached_tokens": 1280, "completion_tokens": 200, "total_tokens": 1700},
            {"prompt_tokens": 1600, "cached_tokens": 1408, "completion_tokens": 150, "total_tokens": 1750},
        ]
    )
    assert summary["cached_tokens"] == 2688
    assert summary["prompt_tokens"] == 3100
    assert summary["calls"] == 2

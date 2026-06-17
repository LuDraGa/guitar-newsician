"""WereCode data-adapter egress fixes (no live Supabase).

Two perf fixes, both Supabase-egress (not LLM):
  #1  the fact-pack build resolves the mix + every stem analysis from ONE fetch,
      indexed by asset_id — not `(1 + analyzed-stems)`× full-blob over-pulls.
  #2  `status()`'s pack read projects only version / created_at / fingerprint via
      a JSON-path select, never the whole `data` blob.

Seam A: `_index_analyses_by_asset` is pure. The adapter methods are exercised over
subclasses that bypass the Supabase client (`__init__` is not called) and count /
record the queries the production code would issue.
"""

from __future__ import annotations

from typing import Any

from maestro_agent.werecode_data import (
    FACT_PACK_ANALYZER,
    WereCodeSongData,
    _index_analyses_by_asset,
)


# --- Seam A: the pure asset_id index ----------------------------------------


def test_index_groups_rows_by_asset_id():
    rows = [
        {"asset_id": "a1", "analyzer_name": "chords", "data": {"x": 1}},
        {"asset_id": "a1", "analyzer_name": "tonal_key", "data": {"x": 2}},
        {"asset_id": "a2", "analyzer_name": "chords", "data": {"x": 3}},
    ]
    index = _index_analyses_by_asset(rows)
    assert set(index) == {"a1", "a2"}
    assert {r["analyzer_name"] for r in index["a1"]} == {"chords", "tonal_key"}
    assert index["a2"][0]["data"]["x"] == 3


def test_index_drops_synthetic_and_unresolvable_rows():
    rows = [
        {"asset_id": "a1", "analyzer_name": "chords", "data": {}},
        # a prior fact pack — synthetic analyzer, no asset_id: the biggest blob,
        # must never be indexed (so the build can't drag it).
        {"asset_id": None, "analyzer_name": FACT_PACK_ANALYZER, "data": {"big": "blob"}},
        # synthetic with an asset_id is still excluded by name.
        {"asset_id": "a2", "analyzer_name": "studio_overview", "data": {}},
        # a non-synthetic row with no asset_id can't be resolved → dropped.
        {"asset_id": None, "analyzer_name": "chords", "data": {}},
    ]
    index = _index_analyses_by_asset(rows)
    assert set(index) == {"a1"}


def test_index_handles_empty():
    assert _index_analyses_by_asset([]) == {}
    assert _index_analyses_by_asset(None) == {}  # type: ignore[arg-type]


# --- #1: the build resolves mix + stems from a single analysis fetch ---------


class _CountingData(WereCodeSongData):
    """Bypasses the Supabase client; counts the one network read the build issues."""

    def __init__(self, assets: list[dict[str, Any]], rows: list[dict[str, Any]]) -> None:
        self._schema = "werecode"
        self._asset_cache: dict[str, list[dict[str, Any]]] = {}
        self._analysis_cache: dict[str, dict[str, list[dict[str, Any]]]] = {}
        self._assets_data = assets
        self._rows = rows
        self.fetch_count = 0

    def _assets(self, song_id: str) -> list[dict[str, Any]]:
        return self._assets_data

    def get_song(self, song_id: str) -> dict[str, Any]:
        return {"duration_sec": 24.0}

    def _fetch_current_analysis_rows(self, song_id: str) -> list[dict[str, Any]]:
        self.fetch_count += 1
        return self._rows  # synthetic rows included → _index must filter them out


def _analysis_row(asset_id: str | None, name: str, x: int) -> dict[str, Any]:
    return {
        "asset_id": asset_id,
        "analyzer_name": name,
        "analyzer_version": "1",
        "ok": True,
        "elapsed_sec": 0.1,
        "error": None,
        "data": {"x": x},
        "created_at": "2026-06-17T00:00:00Z",
    }


def test_build_resolves_mix_and_stems_from_one_fetch():
    assets = [
        {"id": "mix1", "kind": "analysis_json", "metadata": {}, "is_current": True},
        {"id": "s1a", "kind": "stem_analysis_json", "metadata": {"stem_id": "S01"}, "is_current": True},
        {"id": "s2a", "kind": "stem_analysis_json", "metadata": {"stem_id": "S02"}, "is_current": True},
    ]
    rows = [
        _analysis_row("mix1", "chords", 1),
        _analysis_row("s1a", "chords", 2),
        _analysis_row("s2a", "chords", 3),
        # the over-fetch's worst offender: a prior fact pack. Excluded, never resolved.
        _analysis_row(None, FACT_PACK_ANALYZER, 999),
    ]
    data = _CountingData(assets, rows)

    mix = data.get_mix_analysis("song-1")
    s1 = data.get_stem_analysis("song-1", "S01")
    s2 = data.get_stem_analysis("song-1", "S02")

    # The whole build (mix + 2 stems) resolves from ONE fetch, not 1 + stems.
    assert data.fetch_count == 1
    assert mix["response"]["analyses"]["chords"]["x"] == 1
    assert s1["response"]["analyses"]["chords"]["x"] == 2
    assert s2["response"]["analyses"]["chords"]["x"] == 3
    # The synthetic fact-pack blob never leaks into a resolved envelope.
    assert FACT_PACK_ANALYZER not in mix["response"]["analyses"]


def test_missing_stem_analysis_returns_none_without_extra_fetch():
    assets = [{"id": "mix1", "kind": "analysis_json", "metadata": {}, "is_current": True}]
    data = _CountingData(assets, [_analysis_row("mix1", "chords", 1)])
    data.get_mix_analysis("song-1")
    # A stem with no analysis_json asset resolves to None and shares the cached fetch.
    assert data.get_stem_analysis("song-1", "S99") is None
    assert data.fetch_count == 1


# --- #2: status()'s pack read projects JSON fields, not the whole blob --------


class _FakeExec:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _FakeQuery:
    def __init__(self, rows: list[dict[str, Any]], rec: dict[str, Any]) -> None:
        self._rows = rows
        self._rec = rec

    def select(self, cols: str) -> "_FakeQuery":
        self._rec["select"] = cols
        return self

    def eq(self, *args: Any) -> "_FakeQuery":
        self._rec.setdefault("eq", []).append(args)
        return self

    def order(self, column: str, desc: bool = False) -> "_FakeQuery":
        self._rec["order"] = (column, desc)
        return self

    def limit(self, size: int) -> "_FakeQuery":
        self._rec["limit"] = size
        return self

    def execute(self) -> _FakeExec:
        return _FakeExec(self._rows)


class _MetaData(WereCodeSongData):
    def __init__(self, rows: list[dict[str, Any]], rec: dict[str, Any]) -> None:
        self._schema = "werecode"
        self._rows = rows
        self._rec = rec

    def _table(self, name: str) -> _FakeQuery:  # type: ignore[override]
        self._rec["table"] = name
        return _FakeQuery(self._rows, self._rec)


def test_get_latest_fact_pack_meta_projects_json_paths_not_the_blob():
    rec: dict[str, Any] = {}
    fingerprint = {"assets": {"a:1": "h"}, "analyses": {"stem:S03:chords": "1|t"}}
    rows = [{"pack_version": 6, "pack_created_at": "2026-06-17T00:00:00Z", "dependency_fingerprint": fingerprint}]

    meta = _MetaData(rows, rec).get_latest_fact_pack_meta("song-1")

    assert meta == {"version": 6, "created_at": "2026-06-17T00:00:00Z", "dependency_fingerprint": fingerprint}
    # The whole `data` blob must NOT be selected — only the three JSON paths.
    assert rec["select"] == (
        "pack_version:data->version,"
        "pack_created_at:data->created_at,"
        "dependency_fingerprint:data->dependency_fingerprint"
    )
    assert "data->dependency_fingerprint" in rec["select"]
    # Latest row only, ordered by the row timestamp.
    assert rec["order"] == ("created_at", True)
    assert rec["limit"] == 1


def test_get_latest_fact_pack_meta_is_none_when_no_pack():
    assert _MetaData([], {}).get_latest_fact_pack_meta("song-1") is None

"""Ticket #2 — the durable Comprehension Graph store (build → persist → recall → invalidate).

Seam A: `ComprehensionGraphService` against an in-memory fake of the two graph
adapter methods (+ the meta listing) and a counting stub interpreter — never a
live LLM, never a network. Reuses #1's `_pack()` fixture. Seam B: `brief_region`
docstring names recall, registration stays intact, and the `region_key` /
`pack_key` canonicalizers are covered as pure functions.
"""

import copy

from test_brief import _pack

import maestro_agent.comprehension_graph as comprehension_graph
from maestro_agent.agent import create_agent_runner, describe_tools
from maestro_agent.comprehension_graph import (
    COMPREHENSION_GRAPH_VERSION,
    ComprehensionGraphService,
    pack_key,
    region_key,
)

# --- fakes ----------------------------------------------------------------------


class _FakeGraphData:
    """In-memory stand-in for the graph rows in werecode_data — keyed exactly
    like the table's unique constraint, deep-copying on both sides so aliasing
    bugs in the service can't hide behind shared dicts."""

    def __init__(self) -> None:
        self.rows: dict[tuple, dict] = {}
        self.saves = 0

    def get_graph_node(self, song_id, node_type, region_key, pack_key, graph_version):
        row = self.rows.get((song_id, node_type, region_key, pack_key, graph_version))
        return copy.deepcopy(row["node"]) if row else None

    def save_graph_node(self, song_id, owner_id, node_type, region_key, pack_key, graph_version, node):
        self.saves += 1
        self.rows[(song_id, node_type, region_key, pack_key, graph_version)] = {
            "owner_id": owner_id,
            "node": copy.deepcopy(node),
        }

    def list_graph_node_meta(self, song_id):
        return [
            {"node_type": key[1], "region_key": key[2], "pack_key": key[3], "graph_version": key[4]}
            for key in self.rows
            if key[0] == song_id
        ]

    def get_latest_fact_pack(self, song_id):
        return getattr(self, "latest_pack", None)

    def get_latest_fact_pack_meta(self, song_id):
        pack = getattr(self, "latest_pack", None)
        if pack is None:
            return None
        return {"version": pack.get("version"), "created_at": pack.get("created_at")}


class _FakeFactPack:
    """Stands in for SongFactPackService: hands back one canned pack (swappable
    to simulate a rebuild) and exposes `.data` like the real service."""

    def __init__(self, pack, data) -> None:
        self.pack = pack
        self.data = data
        data.latest_pack = pack

    def set_pack(self, pack) -> None:
        self.pack = pack
        self.data.latest_pack = pack

    def ensure_current(self, song_id):
        return self.pack


class _CountingInterpreter:
    def __init__(self, status: str = "ok") -> None:
        self.calls = 0
        self.status = status

    def __call__(self, skeleton):
        self.calls += 1
        return {"kind": "interpretation", "status": self.status, "summary": f"call-{self.calls}", "sections": []}


def _service():
    data = _FakeGraphData()
    fact_pack = _FakeFactPack(_pack(), data)
    return ComprehensionGraphService(fact_pack), data, fact_pack


# --- Seam A: the canonical keys (pure) --------------------------------------------


def test_region_key_is_canonical_over_order_and_duplicates():
    assert region_key([2, 1]) == "sections:1,2"
    assert region_key([1, 2, 2, None]) == "sections:1,2"
    assert region_key([]) == "sections:"


def test_pack_key_is_version_plus_created_at():
    assert pack_key(_pack()) == "v6|2026-07-12T00:00:00Z"


# --- Seam A: build → persist -------------------------------------------------------


def test_build_persists_the_node_on_the_full_key_and_round_trips():
    service, data, _ = _service()
    node = service.build("song-1", "the chorus", _CountingInterpreter())
    key = ("song-1", "section_role_brief", "sections:1,2", "v6|2026-07-12T00:00:00Z", COMPREHENSION_GRAPH_VERSION)
    assert key in data.rows
    assert data.rows[key]["owner_id"] is None  # the fixture pack has no song.owner_id
    stored = data.rows[key]["node"]
    assert stored["node_type"] == "section_role_brief"
    assert stored["source"] == "computed_fresh"
    assert stored["ephemeral"] is False  # durable once persisted
    assert stored["data"]["sections"] == node["data"]["sections"]  # round-trips


def test_ensure_current_twice_interprets_once_and_recalls_second():
    # The ticket's test 5: the trace-visible fresh-vs-recalled distinction.
    service, data, _ = _service()
    interpreter = _CountingInterpreter()
    first = service.ensure_current("song-1", "the chorus", interpreter)
    second = service.ensure_current("song-1", "the chorus", interpreter)
    assert interpreter.calls == 1  # no second interpretation pass
    assert data.saves == 1
    assert first["source"] == "computed_fresh"
    assert second["source"] == "graph_recall"
    assert second["ephemeral"] is False
    assert second["data"]["sections"] == first["data"]["sections"]


def test_region_canonicalization_converges_asks_on_one_node():
    service, data, _ = _service()
    interpreter = _CountingInterpreter()
    service.ensure_current("song-1", "the chorus", interpreter)
    recalled = service.ensure_current("song-1", "CHORUS", interpreter)
    assert interpreter.calls == 1
    assert len(data.rows) == 1
    assert recalled["source"] == "graph_recall"


# --- Seam A: invalidation = key miss ----------------------------------------------


def test_pack_rebuild_same_version_misses_and_recomputes():
    service, _, fact_pack = _service()
    interpreter = _CountingInterpreter()
    service.ensure_current("song-1", "the chorus", interpreter)
    rebuilt = _pack()
    rebuilt["created_at"] = "2026-07-13T00:00:00Z"  # same version, new build
    fact_pack.set_pack(rebuilt)
    node = service.ensure_current("song-1", "the chorus", interpreter)
    assert node["source"] == "computed_fresh"
    assert interpreter.calls == 2


def test_graph_version_bump_misses_and_recomputes(monkeypatch):
    service, _, _ = _service()
    interpreter = _CountingInterpreter()
    service.ensure_current("song-1", "the chorus", interpreter)
    monkeypatch.setattr(comprehension_graph, "COMPREHENSION_GRAPH_VERSION", COMPREHENSION_GRAPH_VERSION + 1)
    node = service.ensure_current("song-1", "the chorus", interpreter)
    assert node["source"] == "computed_fresh"
    assert interpreter.calls == 2


# --- Seam A: failures never persist ------------------------------------------------


def test_failed_judgment_returns_but_is_not_persisted_and_retries():
    service, data, _ = _service()
    failing = _CountingInterpreter(status="unavailable")
    node = service.ensure_current("song-1", "the chorus", failing)
    assert node["interpretation"]["status"] == "unavailable"
    assert node["ephemeral"] is True  # never became durable
    assert data.saves == 0 and data.rows == {}
    # The next ask retries (no cached failure to recall).
    retry = service.ensure_current("song-1", "the chorus", failing)
    assert failing.calls == 2
    assert retry["source"] == "computed_fresh"


def test_unknown_region_errors_and_saves_nothing():
    service, data, _ = _service()
    interpreter = _CountingInterpreter()
    node = service.ensure_current("song-1", "bridge", interpreter)
    assert "error" in node and "bridge" in node["error"]
    assert interpreter.calls == 0  # the judgment is never run on a no-match
    assert data.saves == 0 and data.rows == {}


# --- Seam A: query (read-only) + status ---------------------------------------------


def test_query_is_read_only_none_when_cold_node_when_warm():
    service, _, _ = _service()
    assert service.query("song-1", "the chorus") is None  # cold: no compute
    interpreter = _CountingInterpreter()
    service.ensure_current("song-1", "the chorus", interpreter)
    warm = service.query("song-1", "the chorus")
    assert warm is not None and warm["source"] == "graph_recall"
    assert interpreter.calls == 1  # query never interpreted anything
    assert service.query("song-1", "bridge") is None  # no matching section


def test_status_counts_nodes_and_current_pack_matches():
    service, _, fact_pack = _service()
    interpreter = _CountingInterpreter()
    service.ensure_current("song-1", "the chorus", interpreter)
    status = service.status("song-1")
    assert status["node_count"] == 1 and status["current_node_count"] == 1
    assert status["current_pack_key"] == "v6|2026-07-12T00:00:00Z"
    rebuilt = _pack()
    rebuilt["created_at"] = "2026-07-13T00:00:00Z"
    fact_pack.set_pack(rebuilt)
    status = service.status("song-1")
    assert status["node_count"] == 1 and status["current_node_count"] == 0  # history, not current


# --- Seam B: wiring ------------------------------------------------------------------


class _IntrospectFactPack:
    def query(self, song_id):  # noqa: ARG002 - closures capture but never call it
        return object()


def test_brief_region_docstring_names_recall_and_registration_intact():
    tools = {tool["name"]: tool for tool in describe_tools(_IntrospectFactPack())}
    assert "brief_region" in tools
    desc = tools["brief_region"]["description"]
    assert "Comprehension Graph" in desc
    assert "graph_recall" in desc
    assert tools["brief_region"]["params"] == [
        {"name": "region", "type": "str", "required": True, "default": None}
    ]


def test_brief_region_still_bound_on_the_agent_graph():
    runner = create_agent_runner(None, _IntrospectFactPack(), "song-x", model="openai/gpt-5.4-nano")
    assert "brief_region" in set(runner.nodes["tools"].bound.tools_by_name)

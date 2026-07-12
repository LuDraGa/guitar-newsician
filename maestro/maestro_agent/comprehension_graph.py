"""The durable Comprehension Graph store — ticket #2 of the brief-drill lane.

Makes #1's ephemeral Section×Role node durable: `ComprehensionGraphService`
mirrors `SongFactPackService` (`build / ensure_current / query / status`) and
persists brief nodes to `werecode.maestro_comprehension_graph`, one row per
`(song, node_type, region_key, pack_key, graph_version)`. A warm region is
served from the store — no second judgment pass, `source: graph_recall` on the
trace; a fact-pack rebuild invalidates naturally because the lookup keys on
pack identity, so stale rows simply never match again (history, not deletions).
Population stays lazy per region.

`ensure_current` / `query` are the composition point #4's drill calls directly:
drill fills a cold region through this service — the brief's formula + judgment
— never a parallel rollup.
"""

from __future__ import annotations

from typing import Any, Callable, Iterable

from maestro_agent.brief import NODE_TYPE, build_brief_node, resolve_region
from maestro_agent.fact_pack import SongFactPackService

# The node-schema version (NOT FACT_PACK_VERSION): bumping it orphans old-shape
# rows the same way a pack rebuild does — the lookup key stops matching.
COMPREHENSION_GRAPH_VERSION = 1


def region_key(section_indexes: Iterable[Any]) -> str:
    """Canonical region key from resolved section indexes — pure over
    `resolve_region`'s output, so "the chorus" / "CHORUS" / a numeric index
    that resolve to the same sections converge on one node: 'sections:1,2'."""
    indexes = sorted({int(index) for index in section_indexes if index is not None})
    return "sections:" + ",".join(str(index) for index in indexes)


def pack_key(pack: dict[str, Any]) -> str:
    """The fact-pack identity a node is keyed to — version + created_at (the
    `_agent_cache_key` tail), so a same-version re-analysis busts too."""
    return f"v{pack.get('version')}|{pack.get('created_at')}"


class ComprehensionGraphService:
    """Build, persist, recall, and report one song's Comprehension Graph nodes."""

    def __init__(self, fact_pack: SongFactPackService) -> None:
        self.fact_pack = fact_pack
        self.data = fact_pack.data

    def build(
        self,
        song_id: str,
        region: str,
        interpret: Callable[[dict[str, Any]], dict[str, Any]],
        pack: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Compute the brief node via `build_brief_node` and persist it.

        An unknown-region error node or a failed judgment is returned but never
        persisted — the failure stays ephemeral so the next ask retries instead
        of recalling a cached failure."""
        if pack is None:
            pack = self.fact_pack.ensure_current(song_id)
        node = build_brief_node(pack, region, interpret)
        if "error" in node:
            return node
        if (node.get("interpretation") or {}).get("status") != "ok":
            return node
        node["ephemeral"] = False  # durable from here on
        self.data.save_graph_node(
            song_id=song_id,
            owner_id=(pack.get("song") or {}).get("owner_id"),
            node_type=NODE_TYPE,
            region_key=region_key(node["region"]["section_indexes"]),
            pack_key=pack_key(pack),
            graph_version=COMPREHENSION_GRAPH_VERSION,
            node=node,
        )
        return node

    def ensure_current(
        self,
        song_id: str,
        region: str,
        interpret: Callable[[dict[str, Any]], dict[str, Any]],
    ) -> dict[str, Any]:
        """The `brief_region` path: serve a warm region from the graph (`source:
        graph_recall` — `interpret` is never invoked), or build + persist fresh
        (`source: computed_fresh`)."""
        pack = self.fact_pack.ensure_current(song_id)
        matched = resolve_region(pack.get("sections", []), region)
        if not matched:
            # Delegate the honest no-match error (abstain-and-point); the
            # interpret pass is never run and nothing is saved.
            return build_brief_node(pack, region, interpret)
        stored = self._lookup(song_id, matched, pack_key(pack))
        if stored is not None:
            return stored
        return self.build(song_id, region, interpret, pack=pack)

    def query(self, song_id: str, region: str) -> dict[str, Any] | None:
        """Read-only lookup — no pack build, no judgment. #4's drill reads a
        warm region through this. None when the song has no pack, the region
        matches no section, or the region is cold."""
        pack = self.data.get_latest_fact_pack(song_id)
        if pack is None:
            return None
        matched = resolve_region(pack.get("sections", []), region)
        if not matched:
            return None
        return self._lookup(song_id, matched, pack_key(pack))

    def status(self, song_id: str) -> dict[str, Any]:
        """Freshness view: how many nodes the song has, and how many still
        match the current pack identity + node schema (i.e. are recallable)."""
        meta = self.data.get_latest_fact_pack_meta(song_id)
        current_key = pack_key(meta) if meta else None
        rows = self.data.list_graph_node_meta(song_id)
        current = [
            row
            for row in rows
            if row.get("pack_key") == current_key
            and row.get("graph_version") == COMPREHENSION_GRAPH_VERSION
        ]
        return {
            "song_id": song_id,
            "graph_version": COMPREHENSION_GRAPH_VERSION,
            "node_count": len(rows),
            "current_pack_key": current_key,
            "current_node_count": len(current),
        }

    def _lookup(
        self, song_id: str, matched: list[dict[str, Any]], pack_key_value: str
    ) -> dict[str, Any] | None:
        stored = self.data.get_graph_node(
            song_id=song_id,
            node_type=NODE_TYPE,
            region_key=region_key(section.get("index") for section in matched),
            pack_key=pack_key_value,
            graph_version=COMPREHENSION_GRAPH_VERSION,
        )
        if stored is None:
            return None
        # Copy so the recall flags never alias back into a caller-held store.
        return {**stored, "source": "graph_recall", "ephemeral": False}

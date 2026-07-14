"""Ticket #9 — stem identity curation reaches Maestro (no live LLM, no Supabase).

A learner curating a stem in Studio ("Guitar 2" → "Rhythm Guitar", tags
`["rhythm", "clean"]`) writes `assets.metadata` and *nothing else* — the audio
bytes, and so `checksum_sha256`, never move. Before this ticket that edit was
invisible: the pack stayed cached and the Comprehension Graph kept recalling warm
nodes built on the old, hedged roster. These tests pin the chain that makes the
edit land:

Seam A: `_stem_info` trusts a curated identity (no derived tags growing back).
Seam B: `asset_checksums` hashes stem identity, so `ensure_current` rebuilds.
Seam C: the staleness reason says a part was retagged, not "Updated asset".
Seam D: the rebuilt pack's new `pack_key` makes the old node a key miss — the
        graph re-derives rather than serving a stale understanding (never a delete).
"""

from __future__ import annotations

import copy

from test_brief import _pack
from test_comprehension_graph import _FakeGraphData

from maestro_agent.comprehension_graph import COMPREHENSION_GRAPH_VERSION, ComprehensionGraphService, pack_key, region_key
from maestro_agent.fact_pack import _fingerprint_reasons
from maestro_agent.werecode_data import WereCodeSongData, _identity_hash, _stem_info


def _stem_asset(stem_id: str, *, label: str, tags: list[str], curated: bool = False, checksum: str = "audio-sha") -> dict:
    metadata: dict = {
        "stem": {"id": stem_id, "role": "guitar", "label": label, "tags": tags},
        "stem_id": stem_id,
        "stem_role": "guitar",
        "stem_label": label,
        "stem_tags": tags,
        "role": "guitar",
        # The pipeline's own guesses — the tags a curated identity must NOT re-grow.
        "inst_class": "Electric Guitar",
        "plugin_name": "Clean Strat",
    }
    if curated:
        metadata["stem_identity_curated"] = True
    return {
        "id": f"asset-{stem_id}",
        "kind": "stem_guitar",
        "object_path": f"u/{stem_id}.wav",
        "checksum_sha256": checksum,
        "metadata": metadata,
    }


def _data_with(assets: list[dict]) -> WereCodeSongData:
    """A real WereCodeSongData with its Supabase reads stubbed — `asset_checksums`
    is the unit under test, not the transport."""
    data = object.__new__(WereCodeSongData)
    data._assets = lambda song_id: copy.deepcopy(assets)  # type: ignore[method-assign]
    return data


# --- Seam A: a curated identity is the answer -----------------------------------


def test_uncurated_stem_still_inherits_pipeline_guesses():
    info = _stem_info(_stem_asset("S05", label="Guitar", tags=[]))
    assert info["curated"] is False
    assert "Electric Guitar" in info["tags"]
    assert "Clean Strat" in info["tags"]


def test_curated_stem_drops_derived_tags_so_a_removed_tag_stays_removed():
    info = _stem_info(_stem_asset("S05", label="Rhythm Guitar", tags=["rhythm", "clean"], curated=True))
    assert info["curated"] is True
    assert info["label"] == "Rhythm Guitar"
    # role stays first; the pipeline's inst_class / plugin_name are gone for good.
    assert info["tags"] == ["guitar", "rhythm", "clean"]


# --- Seam B: the identity hash, and the fingerprint it moves ---------------------


def test_identity_hash_is_order_and_case_insensitive():
    left = {"role": "guitar", "label": "Lead Guitar", "tags": ["solo", "lead"]}
    right = {"role": "guitar", "label": "lead guitar", "tags": ["Lead", "Solo"]}
    assert _identity_hash(left) == _identity_hash(right)


def test_identity_hash_moves_on_a_retag():
    before = {"role": "guitar", "label": "Guitar", "tags": []}
    after = {"role": "guitar", "label": "Guitar", "tags": ["rhythm"]}
    assert _identity_hash(before) != _identity_hash(after)


def test_asset_checksums_carry_stem_identity():
    data = _data_with([_stem_asset("S05", label="Guitar", tags=[])])
    hashes = data.asset_checksums("song-1")
    assert hashes["stem_guitar:S05"] == "audio-sha"
    assert "identity:S05" in hashes


def test_retag_moves_the_fingerprint_even_though_the_audio_did_not():
    """The whole point of the seam: same audio bytes, different identity."""
    before = _data_with([_stem_asset("S05", label="Guitar", tags=[])]).asset_checksums("song-1")
    after = _data_with(
        [_stem_asset("S05", label="Rhythm Guitar", tags=["rhythm"], curated=True)]
    ).asset_checksums("song-1")

    assert before["stem_guitar:S05"] == after["stem_guitar:S05"]  # audio untouched…
    assert before["identity:S05"] != after["identity:S05"]  # …identity moved.
    # `ensure_current` compares exactly this dict — so the pack now rebuilds.
    assert before != after


# --- Seam C: the learner is told what actually changed ---------------------------


def test_fingerprint_reason_names_the_retag():
    stored = {"assets": {"identity:S05": "aaa"}, "analyses": {}}
    current = {"assets": {"identity:S05": "bbb"}, "analyses": {}}
    assert _fingerprint_reasons(stored, current) == ["You renamed or retagged S05."]


def test_fingerprint_reason_for_a_brand_new_part():
    stored = {"assets": {}, "analyses": {}}
    current = {"assets": {"identity:S07": "ccc"}, "analyses": {}}
    assert _fingerprint_reasons(stored, current) == ["New part: S07."]


# --- Seam D: the rebuilt pack re-keys the graph (key miss, never a delete) -------


class _FakePackService:
    def __init__(self, pack: dict) -> None:
        self.pack = pack
        self.data = _FakeGraphData()

    def ensure_current(self, song_id: str) -> dict:
        return self.pack


def test_retag_rebuild_makes_the_warm_node_a_key_miss():
    pack = _pack()
    service = ComprehensionGraphService.__new__(ComprehensionGraphService)
    packs = _FakePackService(pack)
    service.fact_pack = packs
    service.data = packs.data

    calls: list[int] = []

    def interpret(_payload: dict) -> dict:
        calls.append(1)
        return {"status": "ok", "summary": "judged"}

    first = service.ensure_current("song-1", "chorus", interpret)
    assert first["source"] == "computed_fresh"
    warm = service.ensure_current("song-1", "chorus", interpret)
    assert warm["source"] == "graph_recall"
    assert len(calls) == 1  # warm region costs no judgment pass

    # The learner retags a guitar → the fingerprint moves → the pack rebuilds with a
    # fresh `created_at`, which is the tail of `pack_key`.
    rebuilt = copy.deepcopy(pack)
    rebuilt["created_at"] = "2026-07-15T12:00:00Z"
    assert pack_key(rebuilt) != pack_key(pack)
    packs.pack = rebuilt

    after = service.ensure_current("song-1", "chorus", interpret)
    assert after["source"] == "computed_fresh"  # re-derived on the corrected roster
    assert len(calls) == 2

    # Invalidation is a key miss, not a deletion: the pre-retag node is still there.
    stale_key = (
        "song-1",
        "section_role_brief",
        region_key(first["region"]["section_indexes"]),
        pack_key(pack),
        COMPREHENSION_GRAPH_VERSION,
    )
    assert stale_key in packs.data.rows

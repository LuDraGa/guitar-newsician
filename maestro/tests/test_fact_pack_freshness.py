"""Fact Pack Freshness — staleness detection (no live LLM, no Supabase).

Seam A: `_fingerprint_reasons` is a pure diff between the pack's stored
dependency fingerprint and the song's current one. Seam B: `status()` assembles
the freshness signal over a fake data adapter (the read-only check that drives
the chat-window banner — it must never build).
"""

from __future__ import annotations

from maestro_agent.fact_pack import FACT_PACK_VERSION, SongFactPackService, _fingerprint_reasons


# --- Seam A: the pure fingerprint diff --------------------------------------


def test_fingerprint_reasons_fresh_when_identical():
    fp = {"assets": {"stem_audio_bass:S03": "abc"}, "analyses": {"stem:S03:chords": "1|2026-06-16T00:00:00Z"}}
    assert _fingerprint_reasons(fp, dict(fp)) == []


def test_fingerprint_reasons_flags_reanalyzed_stem():
    stored = {"assets": {}, "analyses": {"stem:S03:chords": "1|2026-06-16T00:00:00Z"}}
    current = {"assets": {}, "analyses": {"stem:S03:chords": "1|2026-06-16T09:00:00Z"}}
    assert _fingerprint_reasons(stored, current) == ["Stem S03 was re-analyzed."]


def test_fingerprint_reasons_dedupes_multiple_analyzers_per_stem():
    # Re-running a stem touches several analyzers (chords, tonal_key, …) → one reason.
    stored = {"analyses": {"stem:S03:chords": "1|a", "stem:S03:tonal_key": "1|a"}}
    current = {"analyses": {"stem:S03:chords": "1|b", "stem:S03:tonal_key": "1|b"}}
    assert _fingerprint_reasons(stored, current) == ["Stem S03 was re-analyzed."]


def test_fingerprint_reasons_flags_new_and_updated_assets():
    stored = {"assets": {"stem_audio_bass:S03": "abc"}, "analyses": {}}
    current = {"assets": {"stem_audio_bass:S03": "xyz", "stem_audio_guitar:S05": "new"}, "analyses": {}}
    reasons = _fingerprint_reasons(stored, current)
    assert "Updated asset: stem audio bass." in reasons
    assert "New asset: stem audio guitar." in reasons


def test_fingerprint_reasons_flags_mix_reanalysis():
    stored = {"analyses": {"mix:chords": "1|a"}}
    current = {"analyses": {"mix:chords": "1|b"}}
    assert _fingerprint_reasons(stored, current) == ["The mix analysis was re-run."]


def test_fingerprint_reasons_missing_stored_is_no_diff():
    # pre-v5 pack with no stored fingerprint — status()'s version check handles it.
    assert _fingerprint_reasons(None, {"assets": {}, "analyses": {}}) == []


def test_fingerprint_reasons_caps_long_lists():
    stored = {"analyses": {f"stem:S{i:02d}:chords": "1|a" for i in range(10)}}
    current = {"analyses": {f"stem:S{i:02d}:chords": "1|b" for i in range(10)}}
    reasons = _fingerprint_reasons(stored, current)
    assert len(reasons) == 7  # 6 reasons + 1 summary
    assert reasons[-1].startswith("…and 4 more")


# --- Seam B: the read-only status() check -----------------------------------


class _FakeData:
    def __init__(self, latest: dict | None, current_sig: dict) -> None:
        self._latest = latest
        self._current_sig = current_sig

    def get_latest_fact_pack(self, song_id: str) -> dict | None:
        return self._latest

    def dependency_signature(self, song_id: str) -> dict:
        return self._current_sig


def test_status_no_pack_is_stale():
    status = SongFactPackService(_FakeData(None, {"assets": {}, "analyses": {}})).status("song-1")
    assert status["has_pack"] is False
    assert status["stale"] is True
    assert status["version"] is None
    assert status["current_version"] == FACT_PACK_VERSION


def test_status_fresh_pack():
    sig = {"assets": {"a:1": "x"}, "analyses": {"stem:S03:chords": "1|t0"}}
    latest = {"version": FACT_PACK_VERSION, "created_at": "2026-06-16T00:00:00Z", "dependency_fingerprint": sig}
    status = SongFactPackService(_FakeData(latest, dict(sig))).status("song-1")
    assert status["has_pack"] is True
    assert status["stale"] is False
    assert status["reasons"] == []
    assert status["built_at"] == "2026-06-16T00:00:00Z"


def test_status_detects_reanalysis_without_asset_change():
    # The exact gap: a stem re-analysis with no asset-checksum change.
    stored_sig = {"assets": {"x:1": "h"}, "analyses": {"stem:S03:chords": "1|t0"}}
    current_sig = {"assets": {"x:1": "h"}, "analyses": {"stem:S03:chords": "1|t1"}}
    latest = {"version": FACT_PACK_VERSION, "created_at": "t", "dependency_fingerprint": stored_sig}
    status = SongFactPackService(_FakeData(latest, current_sig)).status("song-1")
    assert status["stale"] is True
    assert status["reasons"] == ["Stem S03 was re-analyzed."]


def test_status_flags_version_mismatch():
    sig = {"assets": {}, "analyses": {}}
    latest = {"version": FACT_PACK_VERSION - 1, "created_at": "t", "dependency_fingerprint": sig}
    status = SongFactPackService(_FakeData(latest, dict(sig))).status("song-1")
    assert status["stale"] is True
    assert any("format changed" in reason for reason in status["reasons"])
    assert status["version"] == FACT_PACK_VERSION - 1

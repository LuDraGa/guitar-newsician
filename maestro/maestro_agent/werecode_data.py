"""WereCode data adapter — the Supabase-backed replacement for the POC's
BabySlakh `dataset.py` + `analysis.py`.

The POC read per-(track, stem) audio/MIDI/analysis from local BabySlakh dirs.
WereCode stores the same substrate in the `werecode` schema:

- mix analysis  -> current pipeline rows attached to an `analysis_json` asset
  (with a legacy `maestro_mix_analysis` envelope fallback for old seeds).
- full MIDI     -> `source_midi` asset (fallback: `midi`).
- per-stem audio-> `stem_<role>` assets, keyed by `metadata.stem_id` / `role`.
- per-stem MIDI -> `stem_midi_<role>` assets, keyed by `metadata.stem_id`.
- per-stem analysis -> current pipeline rows attached to `stem_analysis_json`
  assets, keyed by `metadata.stem_id`.

The fact pack persists back as an `analysis_results` row (analyzer
`maestro_song_fact_pack`) — no new asset kind needed.
"""

from __future__ import annotations

from typing import Any

from supabase import create_client

from maestro_agent.config import Settings

STEM_AUDIO_KINDS = {
    "stem_vocals",
    "stem_drums",
    "stem_bass",
    "stem_other",
    "stem_guitar",
    "stem_piano",
}
STEM_MIDI_KINDS = {f"stem_midi_{role}" for role in ("vocals", "drums", "bass", "other", "guitar", "piano")}

MIX_ANALYZER = "maestro_mix_analysis"
FACT_PACK_ANALYZER = "maestro_song_fact_pack"
FULL_MIX_ANALYSIS_KIND = "analysis_json"
STEM_ANALYSIS_KIND = "stem_analysis_json"
SYNTHETIC_ANALYZERS = {MIX_ANALYZER, FACT_PACK_ANALYZER, "studio_overview"}


class SongNotFound(RuntimeError):
    """Raised when no owned song matches the id."""


class AnalysisUnavailable(RuntimeError):
    """Raised when a song has no mix analysis to build a fact pack from."""


class WereCodeSongData:
    """Read per-(song, stem) data from the `werecode` schema + storage."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._schema = settings.werecode_schema
        # Default options (the sync client builds the storage-aware options it
        # needs); scope DB calls to the `werecode` schema per-call via .schema().
        self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        self._asset_cache: dict[str, list[dict[str, Any]]] = {}

    def _table(self, name: str):
        return self.client.schema(self._schema).table(name)

    # ---- songs + assets ----------------------------------------------------

    def get_song(self, song_id: str) -> dict[str, Any]:
        resp = self._table("songs").select("*").eq("id", song_id).limit(1).execute()
        rows = resp.data or []
        if not rows:
            raise SongNotFound(f"No song {song_id}")
        return rows[0]

    def _assets(self, song_id: str) -> list[dict[str, Any]]:
        if song_id not in self._asset_cache:
            resp = (
                self._table("assets")
                .select("*")
                .eq("song_id", song_id)
                .eq("is_current", True)
                .execute()
            )
            self._asset_cache[song_id] = resp.data or []
        return self._asset_cache[song_id]

    @staticmethod
    def _stem_id(asset: dict[str, Any]) -> str | None:
        return (asset.get("metadata") or {}).get("stem_id")

    def list_stems(self, song_id: str) -> list[dict[str, Any]]:
        assets = self._assets(song_id)
        midi_stem_ids = {self._stem_id(a) for a in assets if a["kind"] in STEM_MIDI_KINDS}
        stems: list[dict[str, Any]] = []
        for asset in sorted(assets, key=lambda a: self._stem_id(a) or ""):
            if asset["kind"] not in STEM_AUDIO_KINDS:
                continue
            meta = asset.get("metadata") or {}
            stem_id = self._stem_id(asset)
            stems.append(
                {
                    "stem_id": stem_id,
                    "inst_class": meta.get("inst_class"),
                    "role": meta.get("role") or asset["kind"].removeprefix("stem_"),
                    "is_drum": bool(meta.get("is_drum")),
                    "midi_program_name": meta.get("midi_program_name"),
                    "program_num": meta.get("program_num"),
                    "plugin_name": meta.get("plugin_name"),
                    "integrated_loudness": meta.get("integrated_loudness"),
                    "has_audio": True,
                    "has_midi": stem_id in midi_stem_ids,
                    "kind": asset["kind"],
                }
            )
        return stems

    def asset_manifest(self, song_id: str) -> list[dict[str, Any]]:
        return [
            {
                "kind": a["kind"],
                "stem_id": self._stem_id(a),
                "bucket_id": a["bucket_id"],
                "object_path": a["object_path"],
            }
            for a in self._assets(song_id)
        ]

    def asset_checksums(self, song_id: str) -> dict[str, str]:
        """Per-asset checksums keyed by (kind, stem-or-path) — drives fact-pack
        source-hash invalidation (the analog of the POC's file sha1s)."""
        hashes: dict[str, str] = {}
        for asset in self._assets(song_id):
            checksum = asset.get("checksum_sha256")
            if checksum:
                hashes[f"{asset['kind']}:{self._stem_id(asset) or asset['object_path']}"] = checksum
        return hashes

    # ---- analysis ----------------------------------------------------------

    def get_mix_analysis(self, song_id: str) -> dict[str, Any]:
        pipeline_analysis = self._analysis_for_assets(
            song_id,
            _current_asset_ids(self._assets(song_id), FULL_MIX_ANALYSIS_KIND),
            duration_sec=self.get_song(song_id).get("duration_sec"),
        )
        if pipeline_analysis is not None:
            return pipeline_analysis

        resp = (
            self._table("analysis_results")
            .select("data")
            .eq("song_id", song_id)
            .eq("analyzer_name", MIX_ANALYZER)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise AnalysisUnavailable(
                f"Missing mix analysis for song {song_id}. Seed or analyze it first."
            )
        return rows[0]["data"]

    def get_stem_analysis(self, song_id: str, stem_id: str) -> dict[str, Any] | None:
        return self._analysis_for_assets(
            song_id,
            _current_asset_ids(self._assets(song_id), STEM_ANALYSIS_KIND, stem_id=stem_id),
        )

    def _analysis_for_assets(
        self,
        song_id: str,
        asset_ids: set[str],
        *,
        duration_sec: float | int | None = None,
    ) -> dict[str, Any] | None:
        if not asset_ids:
            return None

        resp = (
            self._table("analysis_results")
            .select("asset_id,analyzer_name,analyzer_version,ok,elapsed_sec,error,data,created_at")
            .eq("song_id", song_id)
            .eq("is_current", True)
            .execute()
        )
        rows = [
            row
            for row in (resp.data or [])
            if row.get("asset_id") in asset_ids
        ]
        return _analysis_envelope_from_rows(rows, duration_sec=duration_sec)

    # ---- MIDI blobs --------------------------------------------------------

    def _download(self, asset: dict[str, Any]) -> bytes:
        return self.client.storage.from_(asset["bucket_id"]).download(asset["object_path"])

    def download_full_midi_bytes(self, song_id: str) -> bytes | None:
        assets = self._assets(song_id)
        for kind in ("source_midi", "midi"):
            for asset in assets:
                if asset["kind"] == kind:
                    return self._download(asset)
        return None

    def download_stem_midi_bytes(self, song_id: str, stem_id: str) -> bytes | None:
        for asset in self._assets(song_id):
            if asset["kind"] in STEM_MIDI_KINDS and self._stem_id(asset) == stem_id:
                return self._download(asset)
        return None

    # ---- fact-pack persistence (analysis_results row) ----------------------

    def save_fact_pack(self, song_id: str, owner_id: str, pack: dict[str, Any]) -> None:
        self._table("analysis_results").insert(
            {
                "song_id": song_id,
                "owner_id": owner_id,
                "analyzer_name": FACT_PACK_ANALYZER,
                "analyzer_version": str(pack.get("version")),
                "ok": True,
                "data": pack,
            }
        ).execute()

    def get_latest_fact_pack(self, song_id: str) -> dict[str, Any] | None:
        resp = (
            self._table("analysis_results")
            .select("data")
            .eq("song_id", song_id)
            .eq("analyzer_name", FACT_PACK_ANALYZER)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0]["data"] if rows else None


def _current_asset_ids(assets: list[dict[str, Any]], kind: str, *, stem_id: str | None = None) -> set[str]:
    ids: set[str] = set()
    for asset in assets:
        if asset.get("kind") != kind or asset.get("is_current") is False:
            continue
        if stem_id is not None and (asset.get("metadata") or {}).get("stem_id") != stem_id:
            continue
        asset_id = asset.get("id")
        if isinstance(asset_id, str) and asset_id:
            ids.add(asset_id)
    return ids


def _analysis_envelope_from_rows(
    rows: list[dict[str, Any]],
    *,
    duration_sec: float | int | None = None,
) -> dict[str, Any] | None:
    analyses: dict[str, Any] = {"_meta": {"duration_sec": duration_sec}}
    for row in sorted(rows, key=lambda item: item.get("created_at") or "", reverse=True):
        name = row.get("analyzer_name")
        if not isinstance(name, str) or not name or name in SYNTHETIC_ANALYZERS or name in analyses:
            continue

        raw_report = row.get("data")
        report = dict(raw_report) if isinstance(raw_report, dict) else {}
        if row.get("analyzer_version") is not None:
            report.setdefault("version", row.get("analyzer_version"))
        if row.get("ok") is not None:
            report.setdefault("ok", row.get("ok"))
        if row.get("elapsed_sec") is not None:
            report.setdefault("elapsed_sec", row.get("elapsed_sec"))
        if row.get("error") is not None:
            report.setdefault("error", row.get("error"))
        analyses[name] = report

    if len(analyses) == 1:
        return None

    return {
        "response": {
            "status": "ok",
            "analyses": analyses,
        }
    }

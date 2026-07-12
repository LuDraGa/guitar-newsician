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

import re
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
        # Current non-synthetic analysis rows, fetched once per song and indexed by
        # asset_id (mirrors `_asset_cache`). The build resolves the mix + every stem
        # from this one map instead of re-pulling all analysis blobs per asset.
        self._analysis_cache: dict[str, dict[str, list[dict[str, Any]]]] = {}

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
        midi_stem_ids = {_stem_info(a)["id"] for a in assets if a["kind"] in STEM_MIDI_KINDS}
        stems: list[dict[str, Any]] = []
        for asset in sorted(assets, key=lambda a: _stem_info(a)["id"]):
            if asset["kind"] not in STEM_AUDIO_KINDS:
                continue
            meta = asset.get("metadata") or {}
            info = _stem_info(asset)
            stems.append(
                {
                    "stem_id": info["id"],
                    # Precise identity (the Prep A metadata) — what the agent reads
                    # to tell "Lead Guitar" from "Rhythm Guitar" / "Synth Pad".
                    "label": info["label"],
                    "role": info["role"],
                    "tags": info["tags"],
                    "inst_class": meta.get("inst_class"),
                    "is_drum": bool(meta.get("is_drum")),
                    "midi_program_name": meta.get("midi_program_name"),
                    "program_num": meta.get("program_num"),
                    "plugin_name": meta.get("plugin_name"),
                    "integrated_loudness": meta.get("integrated_loudness"),
                    "has_audio": True,
                    "has_midi": info["id"] in midi_stem_ids,
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

    def analysis_signatures(self, song_id: str) -> dict[str, str]:
        """Identity (version + created_at) of the current, non-synthetic analysis
        rows the fact pack consumes, keyed by scope. A re-analysis writes a new
        `is_current` row (new created_at) against the *same* `stem_analysis_json`
        asset, so it never moves an asset checksum — this is what makes such an
        update detectable for staleness."""
        assets_by_id = {asset.get("id"): asset for asset in self._assets(song_id)}
        resp = (
            self._table("analysis_results")
            .select("asset_id,analyzer_name,analyzer_version,created_at")
            .eq("song_id", song_id)
            .eq("is_current", True)
            .execute()
        )
        signatures: dict[str, str] = {}
        for row in resp.data or []:
            name = row.get("analyzer_name")
            if not isinstance(name, str) or not name or name in SYNTHETIC_ANALYZERS:
                continue
            asset = assets_by_id.get(row.get("asset_id")) or {}
            stem_id = (asset.get("metadata") or {}).get("stem_id")
            scope = f"stem:{stem_id}" if stem_id else "mix"
            signatures[f"{scope}:{name}"] = f"{row.get('analyzer_version')}|{row.get('created_at')}"
        return signatures

    def dependency_signature(self, song_id: str) -> dict[str, Any]:
        """The fact pack's full input fingerprint: the assets it reads + the
        analysis rows it consumes. Stored at build, recomputed cheaply for the
        staleness check (metadata only — no MIDI download, no rebuild)."""
        return {
            "assets": self.asset_checksums(song_id),
            "analyses": self.analysis_signatures(song_id),
        }

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
        index = self._current_analyses(song_id)
        rows: list[dict[str, Any]] = []
        for asset_id in asset_ids:
            rows.extend(index.get(asset_id, []))
        return _analysis_envelope_from_rows(rows, duration_sec=duration_sec)

    def _current_analyses(self, song_id: str) -> dict[str, list[dict[str, Any]]]:
        """All current, non-synthetic analysis rows for the song — fetched ONCE per
        process per song (mirrors `_asset_cache`) and indexed by `asset_id`. The
        fact-pack build resolves the mix analysis plus every stem analysis from this
        single map, replacing the old `(1 + analyzed-stems)`× full-blob over-fetch
        (each call previously pulled *every* analysis `data` blob, then kept one)."""
        if song_id not in self._analysis_cache:
            self._analysis_cache[song_id] = _index_analyses_by_asset(
                self._fetch_current_analysis_rows(song_id)
            )
        return self._analysis_cache[song_id]

    def _fetch_current_analysis_rows(self, song_id: str) -> list[dict[str, Any]]:
        """The one network read behind `_current_analyses`. Excludes synthetic
        analyzers (fact packs / overviews) server-side so their large `data` blobs
        — the biggest rows in the schema — never cross the wire on a build."""
        resp = (
            self._table("analysis_results")
            .select("asset_id,analyzer_name,analyzer_version,ok,elapsed_sec,error,data,created_at")
            .eq("song_id", song_id)
            .eq("is_current", True)
            .not_.in_("analyzer_name", list(SYNTHETIC_ANALYZERS))
            .execute()
        )
        return resp.data or []

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
        # A build is the natural refresh point: drop the cached analysis index so the
        # next read re-derives from current rows (a rebuild was triggered precisely
        # because inputs may have moved).
        self._analysis_cache.pop(song_id, None)

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

    def get_latest_fact_pack_meta(self, song_id: str) -> dict[str, Any] | None:
        """Projected metadata for the latest fact pack — `version` / `created_at` /
        `dependency_fingerprint` only, read via PostgREST JSON-path projection so the
        whole `data` blob (the largest row in the schema) never transfers. Drives the
        read-only `status()` freshness poll, hit on every song-select; the full pack
        still loads through `get_latest_fact_pack` on the build/query path."""
        resp = (
            self._table("analysis_results")
            .select(
                "pack_version:data->version,"
                "pack_created_at:data->created_at,"
                "dependency_fingerprint:data->dependency_fingerprint"
            )
            .eq("song_id", song_id)
            .eq("analyzer_name", FACT_PACK_ANALYZER)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        row = rows[0]
        return {
            "version": row.get("pack_version"),
            "created_at": row.get("pack_created_at"),
            "dependency_fingerprint": row.get("dependency_fingerprint"),
        }

    # ---- comprehension graph (maestro_comprehension_graph rows) --------------
    # The durable brief-node store (#2). Not product CRUD: three methods scoped
    # to one table — exact-key read, upsert, and a meta-only listing for status.

    def get_graph_node(
        self,
        song_id: str,
        node_type: str,
        region_key: str,
        pack_key: str,
        graph_version: int,
    ) -> dict[str, Any] | None:
        resp = (
            self._table("maestro_comprehension_graph")
            .select("node")
            .eq("song_id", song_id)
            .eq("node_type", node_type)
            .eq("region_key", region_key)
            .eq("pack_key", pack_key)
            .eq("graph_version", graph_version)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0]["node"] if rows else None

    def save_graph_node(
        self,
        song_id: str,
        owner_id: str,
        node_type: str,
        region_key: str,
        pack_key: str,
        graph_version: int,
        node: dict[str, Any],
    ) -> None:
        # Upsert on the unique key so a concurrent race converges on one row
        # instead of erroring.
        self._table("maestro_comprehension_graph").upsert(
            {
                "song_id": song_id,
                "owner_id": owner_id,
                "node_type": node_type,
                "region_key": region_key,
                "pack_key": pack_key,
                "graph_version": graph_version,
                "node": node,
            },
            on_conflict="song_id,node_type,region_key,pack_key,graph_version",
        ).execute()

    def list_graph_node_meta(self, song_id: str) -> list[dict[str, Any]]:
        """Key columns only — the `node` jsonb blob never crosses the wire, so
        the graph `status()` freshness view stays cheap."""
        resp = (
            self._table("maestro_comprehension_graph")
            .select("node_type,region_key,pack_key,graph_version,created_at")
            .eq("song_id", song_id)
            .execute()
        )
        return resp.data or []


# --- stem identity (Python port of src/lib/music/stem-metadata.ts getStemInfo) ---
# The Prep A upload work writes precise stem identity (a nested `stem` object +
# `stem_label`/`stem_tags`); older seeds carry only top-level `stem_id`/`role`/
# `inst_class`. This mirrors the TS precedence so the agent gets the same identity
# the Studio shows, on both old seeds and new uploads.

STEM_ROLES = ("vocals", "guitar", "bass", "drums", "piano", "other")


def _clean_str(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


def _first_clean(*values: Any) -> str | None:
    for value in values:
        cleaned = _clean_str(value)
        if cleaned:
            return cleaned
    return None


def _to_stem_role(value: Any) -> str | None:
    text = _clean_str(value)
    if text is None:
        return None
    normalized = text.lower().removeprefix("stem_").removeprefix("midi_")
    return normalized if normalized in STEM_ROLES else None


def _role_from_kind(kind: str) -> str | None:
    if kind.startswith("stem_midi_"):
        return _to_stem_role(kind[len("stem_midi_") :])
    if kind.startswith("stem_"):
        return _to_stem_role(kind[len("stem_") :])
    return None


def _label_from_value(value: Any) -> str | None:
    cleaned = _clean_str(value)
    if not cleaned:
        return None
    text = re.sub(r"^stem[_-]", "", cleaned, flags=re.IGNORECASE)
    text = re.sub(r"^stem midi[_-]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[_-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"\b\w", lambda m: m.group(0).upper(), text)


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _unique_tags(values: list[Any]) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for value in values:
        tag = _clean_str(value)
        if not tag:
            continue
        normalized = tag.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        tags.append(tag)
    return tags


def _object_identity(asset: dict[str, Any]) -> str | None:
    path = asset.get("object_path")
    if not isinstance(path, str):
        return None
    parts = [part for part in path.split("/") if part]
    if not parts:
        return None
    return _clean_str(re.sub(r"\.[^.]+$", "", parts[-1]))


def _stem_info(asset: dict[str, Any]) -> dict[str, Any]:
    metadata = asset.get("metadata") or {}
    nested = metadata.get("stem") if isinstance(metadata.get("stem"), dict) else {}
    role = (
        _to_stem_role(nested.get("role"))
        or _to_stem_role(metadata.get("stem_role"))
        or _to_stem_role(metadata.get("role"))
        or _role_from_kind(str(asset.get("kind") or ""))
        or "other"
    )
    stem_id = (
        _first_clean(nested.get("id"), metadata.get("stem_id"), metadata.get("stem_key"), metadata.get("id"))
        or _object_identity(asset)
        or role
    )
    label = (
        _first_clean(nested.get("label"), metadata.get("stem_label"), metadata.get("label"))
        or _label_from_value(
            _first_clean(metadata.get("inst_class"), metadata.get("midi_program_name"), metadata.get("plugin_name"))
        )
        or _label_from_value(stem_id)
        or _label_from_value(role)
        or "Other"
    )
    tags = [
        tag
        for tag in _unique_tags(
            [
                role,
                *_string_list(nested.get("tags")),
                *_string_list(metadata.get("stem_tags")),
                *_string_list(metadata.get("tags")),
                _first_clean(metadata.get("inst_class")),
                _first_clean(metadata.get("midi_program_name")),
                _first_clean(metadata.get("plugin_name")),
            ]
        )
        if tag.lower() != label.lower()
    ]
    return {"id": stem_id, "role": role, "label": label, "tags": tags}


def _index_analyses_by_asset(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group current analysis rows by `asset_id` — the in-memory half of the
    single-fetch analysis cache (pure, unit-tested directly). Drops rows that can't
    be resolved to an asset: synthetic analyzers (fact packs / overviews) and any
    row with no usable `asset_id`. Defensive against the server-side filter — a
    synthetic row that still arrives is excluded here too."""
    index: dict[str, list[dict[str, Any]]] = {}
    for row in rows or []:
        name = row.get("analyzer_name")
        if not isinstance(name, str) or not name or name in SYNTHETIC_ANALYZERS:
            continue
        asset_id = row.get("asset_id")
        if isinstance(asset_id, str) and asset_id:
            index.setdefault(asset_id, []).append(row)
    return index


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

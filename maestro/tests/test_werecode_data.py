from maestro_agent.werecode_data import _analysis_envelope_from_rows, _current_asset_ids


def test_current_asset_ids_separates_mix_and_stem_analysis_assets():
    assets = [
        {"id": "mix-current", "kind": "analysis_json", "is_current": True, "metadata": {}},
        {"id": "mix-old", "kind": "analysis_json", "is_current": False, "metadata": {}},
        {"id": "stem-s01", "kind": "stem_analysis_json", "is_current": True, "metadata": {"stem_id": "S01"}},
        {"id": "stem-s02", "kind": "stem_analysis_json", "is_current": True, "metadata": {"stem_id": "S02"}},
    ]

    assert _current_asset_ids(assets, "analysis_json") == {"mix-current"}
    assert _current_asset_ids(assets, "stem_analysis_json", stem_id="S01") == {"stem-s01"}


def test_analysis_envelope_from_rows_synthesizes_legacy_shape():
    envelope = _analysis_envelope_from_rows(
        [
            {
                "asset_id": "mix-current",
                "analyzer_name": "studio_overview",
                "data": {"bpm": 120},
                "created_at": "2026-06-16T00:00:03Z",
            },
            {
                "asset_id": "mix-current",
                "analyzer_name": "tempo_beats",
                "analyzer_version": "tempo-v1",
                "ok": True,
                "elapsed_sec": 1.2,
                "error": None,
                "data": {"data": {"bpm": 120}},
                "created_at": "2026-06-16T00:00:02Z",
            },
            {
                "asset_id": "mix-current",
                "analyzer_name": "chords",
                "ok": True,
                "data": {"version": "chords-v1", "data": {"progression": []}},
                "created_at": "2026-06-16T00:00:01Z",
            },
        ],
        duration_sec=12.5,
    )

    assert envelope is not None
    analyses = envelope["response"]["analyses"]
    assert analyses["_meta"] == {"duration_sec": 12.5}
    assert set(analyses) == {"_meta", "tempo_beats", "chords"}
    assert analyses["tempo_beats"]["version"] == "tempo-v1"
    assert analyses["tempo_beats"]["data"]["bpm"] == 120


def test_analysis_envelope_from_rows_prefers_newest_duplicate_analyzer_row():
    envelope = _analysis_envelope_from_rows(
        [
            {
                "analyzer_name": "tempo_beats",
                "data": {"data": {"bpm": 90}},
                "created_at": "2026-06-16T00:00:01Z",
            },
            {
                "analyzer_name": "tempo_beats",
                "data": {"data": {"bpm": 120}},
                "created_at": "2026-06-16T00:00:02Z",
            },
        ]
    )

    assert envelope is not None
    assert envelope["response"]["analyses"]["tempo_beats"]["data"]["bpm"] == 120


def test_analysis_envelope_from_rows_returns_none_without_real_analyzers():
    assert _analysis_envelope_from_rows([{"analyzer_name": "studio_overview", "data": {}}]) is None

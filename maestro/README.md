# Maestro agent (local dev service)

The Maestro music-coach agent, ported from the `modal_apis/Maestro` POC into
WereCode. It runs **locally** for now (uv + uvicorn) and is destined for Modal
later (see `docs/maestro/`). It is **not** part of the `backend/` boundary
(which is YouTube-download-only); this is the greenfield coach agent.

What it is: the baseline single-song Q&A agent. It builds a `SongFactPack` from
WereCode's stored per-(song, stem) analysis + MIDI and answers questions about
key / sections / chords / tempo / parts, with evidence and a reasoning trace.

## How it differs from the POC

- **Brains ported as-is:** the fact-pack music logic, the DeepAgents wiring, the
  7 bounded tools, the 4 specialists, the trace, and the confidence model.
- **Plumbing rewritten:** the POC read local BabySlakh dirs; this reads the
  `werecode` schema (Supabase) — `analysis_results` for mix analysis and the
  `stem_*` / `stem_midi_*` assets for per-stem data (`maestro_agent/werecode_data.py`).
- **LLM calls go through LiteLLM** (`maestro_agent/llm.py`) for unified token/cost
  tracking, observability, and easy provider switching (added in C1b).

## Run

```bash
cd maestro
uv sync
# .env carries OPENAI_API_KEY + MAESTRO_AGENT_MODEL (from the POC) and the
# WereCode Supabase service-role creds (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
uv run uvicorn maestro_agent.app:app --reload --port 8000
```

Next talks to this service via `MAESTRO_AGENT_URL` (default `http://127.0.0.1:8000`);
swapping that for the Modal `modalFetch` chokepoint later needs no route changes.

## Endpoints

```text
POST /fact-pack/build     { song_id }      -> build + persist the SongFactPack
GET  /fact-pack/{song_id}                  -> latest persisted SongFactPack
POST /chat                { song_id, message, history } -> agent answer + trace
GET  /health
```

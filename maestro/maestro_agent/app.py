"""Slim FastAPI surface for the Maestro agent (local dev service).

Mirrors the POC's agent-facing seams (`/api/fact-pack/*`, `/api/agent/chat`),
trimmed to what the coach needs. Next talks to this via `MAESTRO_AGENT_URL`.
The chat route imports the agent stack lazily so the fact-pack routes (and the
C1a data layer) run without the LLM dependencies installed.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from maestro_agent.config import Settings, load_settings
from maestro_agent.fact_pack import FactPackUnavailable, SongFactPackService
from maestro_agent.werecode_data import SongNotFound, WereCodeSongData


class FactPackBuildRequest(BaseModel):
    song_id: str


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    song_id: str
    message: str
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    model: str | None = None
    # Traceability lane: Langfuse groups turns by session (the client's
    # conversation id) and user (the song owner, from the Next route).
    session_id: str | None = Field(default=None, max_length=128)
    user_id: str | None = Field(default=None, max_length=128)


class FeedbackRequest(BaseModel):
    trace_id: str = Field(min_length=1, max_length=64)
    verdict: str = Field(pattern="^(up|down)$")
    comment: str | None = Field(default=None, max_length=2000)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    data = WereCodeSongData(settings)
    fact_pack = SongFactPackService(data)

    app = FastAPI(title="Maestro Agent", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", **settings.public_dict()}

    @app.get("/tools")
    def list_tools() -> dict[str, Any]:
        # Lazy import keeps the heavy agent stack off the fact-pack path.
        from maestro_agent.agent import describe_tools

        return {"tools": describe_tools(fact_pack)}

    @app.post("/fact-pack/build")
    def build_fact_pack(request: FactPackBuildRequest) -> dict[str, Any]:
        try:
            return fact_pack.build(request.song_id)
        except SongNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FactPackUnavailable as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/fact-pack/{song_id}")
    def get_fact_pack(song_id: str) -> dict[str, Any]:
        try:
            return fact_pack.ensure_current(song_id)
        except SongNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FactPackUnavailable as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/fact-pack/{song_id}/status")
    def fact_pack_status(song_id: str) -> dict[str, Any]:
        # Cheap read-only freshness check (no MIDI download, no rebuild) — drives
        # the chat-window staleness signal.
        try:
            return fact_pack.status(song_id)
        except SongNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/chat")
    def chat(request: ChatRequest) -> dict[str, Any]:
        if not settings.agent_enabled:
            raise HTTPException(status_code=503, detail="Agent disabled (MAESTRO_AGENT_ENABLED=0)")
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="message is required")
        # Lazy import: keeps the agent stack (deepagents/litellm) out of the
        # fact-pack path and the C1a data layer.
        from maestro_agent.agent import ModelNotAllowed, invoke_agent

        try:
            return invoke_agent(
                settings,
                fact_pack,
                request.message,
                request.song_id,
                [item.model_dump() for item in request.history],
                request.model,
                session_id=request.session_id,
                user_id=request.user_id,
            )
        except ModelNotAllowed as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except SongNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FactPackUnavailable as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/feedback")
    def feedback(request: FeedbackRequest) -> dict[str, Any]:
        # Observability-side copy of a user verdict: attach it to the Langfuse
        # trace as a score. The durable record is the Supabase row the Next
        # route writes first — this call is best-effort and never fails hard.
        from maestro_agent.tracing import record_feedback_score

        recorded = record_feedback_score(request.trace_id, request.verdict, request.comment)
        return {"ok": True, "langfuse_recorded": recorded}

    return app


app = create_app()

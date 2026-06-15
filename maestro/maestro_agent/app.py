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


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    data = WereCodeSongData(settings)
    fact_pack = SongFactPackService(data)

    app = FastAPI(title="Maestro Agent", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", **settings.public_dict()}

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

    @app.post("/chat")
    def chat(request: ChatRequest) -> dict[str, Any]:
        if not settings.agent_enabled:
            raise HTTPException(status_code=503, detail="Agent disabled (MAESTRO_AGENT_ENABLED=0)")
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="message is required")
        # Lazy import: keeps the agent stack (deepagents/litellm) out of the
        # fact-pack path and the C1a data layer.
        from maestro_agent.agent import invoke_agent

        try:
            return invoke_agent(
                settings,
                fact_pack,
                request.message,
                request.song_id,
                [item.model_dump() for item in request.history],
            )
        except SongNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FactPackUnavailable as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    return app


app = create_app()

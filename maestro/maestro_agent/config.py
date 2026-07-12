"""Runtime configuration for the Maestro agent service.

Env-driven and self-contained (its own `.env`), so the local service stays
decoupled from the Next app. The Supabase service-role creds let the WereCode
data adapter read owner-scoped `werecode` rows + storage directly during local
development; the agent model/key come from the ported POC config.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    werecode_schema: str
    sources_bucket: str
    artifacts_bucket: str
    agent_model: str
    agent_enabled: bool
    # Soft per-turn cost ceiling in USD; 0 disables the check. The guard flags
    # over-budget turns in the trace — it never blocks a turn.
    turn_budget_usd: float = 0.50
    # The brief capability's judgment-pass model (#7 verdict: frontier depth
    # belongs to the brief's single interpretation pass, not the chat seat).
    brief_model: str = "openai/gpt-5.5"

    def public_dict(self) -> dict[str, object]:
        # Never expose the service-role key.
        return {
            "supabase_url": self.supabase_url,
            "werecode_schema": self.werecode_schema,
            "sources_bucket": self.sources_bucket,
            "artifacts_bucket": self.artifacts_bucket,
            "agent_model": self.agent_model,
            "agent_enabled": self.agent_enabled,
            "turn_budget_usd": self.turn_budget_usd,
            "brief_model": self.brief_model,
        }


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing Supabase config: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) "
            "and SUPABASE_SERVICE_ROLE_KEY in maestro/.env"
        )
    return Settings(
        supabase_url=url.rstrip("/"),
        supabase_service_role_key=key,
        werecode_schema=os.getenv("WERECODE_SCHEMA", "werecode"),
        sources_bucket=os.getenv("WERECODE_SOURCES_BUCKET", "werecode-sources"),
        artifacts_bucket=os.getenv("WERECODE_ARTIFACTS_BUCKET", "werecode-artifacts"),
        agent_model=os.getenv("MAESTRO_AGENT_MODEL", "openai/gpt-5.5"),
        agent_enabled=_env_bool("MAESTRO_AGENT_ENABLED", True),
        turn_budget_usd=_env_float("MAESTRO_TURN_BUDGET_USD", 0.50),
        brief_model=os.getenv("MAESTRO_BRIEF_MODEL", "openai/gpt-5.5"),
    )

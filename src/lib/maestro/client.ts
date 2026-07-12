import 'server-only';

/**
 * Seam to the Maestro coach agent.
 *
 * Today the agent runs as a local Python service (uv + uvicorn, see
 * `maestro/`); tomorrow it moves to Modal. This module is the single transport
 * chokepoint so that promotion is a swap of `maestroFetch` for `modalFetch`
 * with no route-handler changes — exactly how `src/lib/modal/client.ts` fronts
 * the Modal gateway. The `/api/maestro/*` routes call only the typed helpers
 * below; they never touch the agent URL directly.
 *
 * The Next boundary speaks camelCase; the local FastAPI service speaks
 * snake_case (`song_id`). The translation lives here so neither the routes nor
 * the UI carry the service's wire shape.
 */

const FALLBACK_MAESTRO_AGENT_URL = 'http://127.0.0.1:8000';

export function getMaestroAgentUrl() {
  return process.env.MAESTRO_AGENT_URL ?? FALLBACK_MAESTRO_AGENT_URL;
}

/**
 * Carries the upstream agent's HTTP status so route handlers can pass through a
 * meaningful code (404 unknown song, 409 no fact pack, 503 agent disabled)
 * instead of collapsing everything to 500.
 */
export class MaestroAgentError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'MaestroAgentError';
    this.status = status;
    this.detail = detail;
  }
}

async function maestroFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, getMaestroAgentUrl());
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // The local agent is not running / unreachable. Surface as 503 so the UI
    // can tell the developer to start `uvicorn maestro_agent.app:app`.
    throw new MaestroAgentError(
      `Maestro agent unreachable at ${getMaestroAgentUrl()} (is the local service running?)`,
      503,
      cause instanceof Error ? cause.message : String(cause)
    );
  }

  const raw = await response.text();
  const parsed = raw ? safeJson(raw) : null;

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === 'object' && 'detail' in parsed
        ? (parsed as { detail: unknown }).detail
        : parsed ?? raw;
    const message = typeof detail === 'string' ? detail : `Maestro agent request failed (${response.status})`;
    throw new MaestroAgentError(message, response.status, detail);
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type MaestroChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** The agent returns the full SongFactPack as an opaque-but-readable object. */
export type MaestroFactPack = Record<string, unknown>;

export type MaestroChatResult = {
  content: string;
  /** Reasoning trace: usage (tokens/cost), tool calls, timings. */
  raw: Record<string, unknown> | null;
};

export type MaestroToolParam = {
  name: string;
  type: string | null;
  required: boolean;
  default: unknown;
};

export type MaestroTool = {
  name: string;
  description: string;
  params: MaestroToolParam[];
};

export function getMaestroTools(): Promise<{ tools: MaestroTool[] }> {
  return maestroFetch<{ tools: MaestroTool[] }>('/tools');
}

export function buildFactPack(songId: string): Promise<MaestroFactPack> {
  return maestroFetch<MaestroFactPack>('/fact-pack/build', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId }),
  });
}

export function getFactPack(songId: string): Promise<MaestroFactPack> {
  return maestroFetch<MaestroFactPack>(`/fact-pack/${encodeURIComponent(songId)}`);
}

/** Whether the latest pack still reflects the song's current inputs (assets +
 * analysis rows). Cheap, read-only — never triggers a rebuild. */
export type MaestroFactPackStatus = {
  songId: string;
  hasPack: boolean;
  stale: boolean;
  version: number | null;
  currentVersion: number;
  builtAt: string | null;
  reasons: string[];
};

type MaestroFactPackStatusWire = {
  song_id: string;
  has_pack: boolean;
  stale: boolean;
  version: number | null;
  current_version: number;
  built_at: string | null;
  reasons: string[];
};

export async function getFactPackStatus(songId: string): Promise<MaestroFactPackStatus> {
  const wire = await maestroFetch<MaestroFactPackStatusWire>(
    `/fact-pack/${encodeURIComponent(songId)}/status`
  );
  return {
    songId: wire.song_id,
    hasPack: Boolean(wire.has_pack),
    stale: Boolean(wire.stale),
    version: wire.version ?? null,
    currentVersion: wire.current_version,
    builtAt: wire.built_at ?? null,
    reasons: Array.isArray(wire.reasons) ? wire.reasons : [],
  };
}

export function chatWithMaestro(input: {
  songId: string;
  message: string;
  history: MaestroChatHistoryMessage[];
  /** LiteLLM `provider/model` (e.g. `openai/gpt-5.4-nano`); omitted = agent default. */
  model?: string;
  /** Conversation id — Langfuse groups the whole conversation as one session. */
  sessionId?: string;
  /** Song owner's user id — Langfuse per-user view for cohort observation. */
  userId?: string;
}): Promise<MaestroChatResult> {
  return maestroFetch<MaestroChatResult>('/chat', {
    method: 'POST',
    body: JSON.stringify({
      song_id: input.songId,
      message: input.message,
      history: input.history,
      model: input.model,
      session_id: input.sessionId,
      user_id: input.userId,
    }),
  });
}

/**
 * Forward a user verdict to the agent so it lands as a Langfuse score on the
 * turn's trace. Best-effort by design: the durable record is the
 * `werecode.maestro_feedback` row the route writes first.
 */
export function sendFeedbackScore(input: {
  traceId: string;
  verdict: 'up' | 'down';
  comment?: string;
}): Promise<{ ok: boolean; langfuse_recorded: boolean }> {
  return maestroFetch<{ ok: boolean; langfuse_recorded: boolean }>('/feedback', {
    method: 'POST',
    body: JSON.stringify({
      trace_id: input.traceId,
      verdict: input.verdict,
      comment: input.comment,
    }),
  });
}

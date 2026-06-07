# Execution Doc: Async + Parallel Workflow Pipeline (Modal spawn, no broker)

Date: 2026-06-07
Status: Phases 1 & 2 implemented (Option 2: Modal spawn + Next poll). WereCode
`pnpm typecheck` + `pnpm lint` pass; Modal gateway `py_compile` + contract tests
(9/9) pass. Ship steps pending (run 2 SQL migrations, `modal deploy`, set
`WERECODE_MODAL_ASYNC=1`, e2e with a real song). Phase 3 (Realtime + progress)
optional/pending.
Owner: Claude

## Objective

Let a song's Modal-backed stages (stem separation, analysis/chords, lyrics
fetch, lyrics alignment, MIDI transcribe, MusicXML) run **concurrently** instead
of one-at-a-time, stop the UI from blocking while any one runs, **deduplicate**
redundant triggers, and make in-flight work **survive a reload** — using the
runtimes we already have (Next/Vercel + Supabase + Modal). No message broker.

## Context — current behavior (ground truth)

Today the pipeline is fully serialized on both ends:

- **Client mutex.** Studio keeps a single `running: string | null`
  (`StudioClient.tsx:156`). `runWorkflow` sets it, `await`s the fetch, clears it
  in `finally` (`StudioClient.tsx:481`). **Every** stage button is
  `disabled={Boolean(running)}` (`:1009`, `:1166`, `:1545`, `:1600`, `:2191`), so
  starting stem separation disables Analyze / Fetch lyrics / Align / MIDI until it
  returns. ("Detect chords" is not its own endpoint — chords are an output of the
  Analysis workflow.)
- **Routes block synchronously.** `/api/workflows/*` `await` the whole run and
  hold the connection open with `maxDuration = 300` (separate/analyze/lyrics
  routes). `runJobWithModal` does `await modalFetch(endpoint)`
  (`modal-workflows.ts:729`) — the request stays open for the entire Modal
  compute.
- **No dedup.** `fetchJson` is a plain fetch (no in-flight guard, no abort). Two
  tabs, or a reload mid-run, can fire duplicate Modal jobs. There is no DB
  idempotency constraint on `jobs`.

What already exists and makes Option A cheap (we are ~80% there):

- **`jobs` table** with the right lifecycle: `status` ∈
  `queued/processing/ready/failed/cancelled`, plus `progress`, `started_at`,
  `completed_at`, `request_payload`, `response_payload`, `diagnostics`,
  `modal_endpoint` (`supabase/sql/2026-05-25_werecode_schema.sql:133`, status
  check `:157`). Indexed by `(owner_id,status,created_at)` and `(song_id,created_at)`.
- **`runStoredJob`** (`modal-workflows.ts:125`) — an enqueue→run split already
  exists; it reads a job row and dispatches by `payload.workflow`.
- **`runJobWithModal`** (`modal-workflows.ts`) already (a) sets the job to
  `processing` *before* calling Modal, and (b) **handles a non-terminal Modal
  response**: `pending = modalStatus === 'accepted' || 'processing'` leaves the
  job in `processing` with `completed_at: null` (`:745`–`:789`). The async tail is
  pre-wired.
- **`maybeSkipIfFresh`** — result-level dedup (skips recompute unless `force`).
- **Pipeline** already derives `activeJobs` from `queued|processing` rows
  (`PipelineClient.tsx:302`) and loads in parallel via `Promise.all`.

Out-of-repo boundary: the **Modal app is a deployed FastAPI service**
(`lib/modal/client.ts` → `…modal.run`); its source is **not in this repo** (no
`modal.App`/`@app.function` found). Anything requiring Modal to return early or
call back is a cross-boundary change, flagged explicitly below.

## Decision: Option A — Modal-native async + Supabase as the job store

Chosen approach, in order of dependency:

1. **The `jobs` table is the queue and the source of truth.** Status, progress,
   payloads, and dedup all live in Postgres we already run. No second store.
2. **Parallelism comes from independent job rows**, not from a concurrency
   primitive. The client fires N workflows; each is its own row; busy-state is
   *derived from the rows*, per stage.
3. **Dedup is enforced in the DB**, not in JS: a partial unique index on
   `(song_id, job_type)` for active statuses makes a duplicate trigger converge on
   the existing in-flight job. `maybeSkipIfFresh` still covers "already computed".
4. **True async (Phase 2) uses Modal's own async + a writeback**, not a held
   connection: Modal returns `accepted` immediately and POSTs results back to an
   authenticated internal Next route that runs the *existing* finalize tail.
5. **Phasing isolates the cross-boundary work.** Phase 1 is 100% inside the
   Next/Supabase boundary and already delivers the user-visible win; Phase 2 is
   the only part that needs Modal-side changes.

### Rejected alternative: CloudAMQP / RabbitMQ (and the "Little Lemur" free plan)

**Decision: rejected.** Reasons, most-decisive first:

1. **Needs a long-lived consumer; serverless can't host one.** RabbitMQ is
   push-based — something must hold an open connection and `consume` forever.
   Vercel functions are short-lived and stateless, so this forces a **4th
   always-on runtime** (Railway/Render/VPS) purely to drain the queue, directly
   violating this repo's runtime split (Next/Vercel + Supabase + Modal;
   `backend/` is local-only — see `CLAUDE.md`).
2. **Redundant with Modal.** Modal already queues, schedules, and autoscales
   invocations. A broker in front would hand each message to a consumer that just
   calls Modal anyway — middleware with no added capability at this scale.
3. **Poor producer fit too.** A serverless publisher would open/close an AMQP
   connection per invocation (anti-pattern, and the free plan caps connections),
   or fall back to CloudAMQP's HTTP publish API — at which point AMQP's strengths
   are unused.
4. **Free plan is dev-grade.** "Little Lemur" (the actual free plan name) is a
   shared instance with a low connection cap (~20), ~1M messages/month, and a low
   queued-message ceiling — not a foundation for the durable pipeline.
5. **Duplicates the source of truth.** The durable state we need (status,
   progress, payloads, dedup) already lives in the Postgres `jobs` table; a broker
   would split it across two systems and invite drift.

**When CloudAMQP *would* be justified** (revisit triggers): a dedicated
always-on worker fleet we run regardless; multi-service pub/sub fan-out; priority
or topic routing; broker-level dead-letter/TTL semantics. None apply at current
scale.

### Also considered, deferred: pgmq (Postgres Message Queue)

A real queue that stays inside Supabase (visibility timeouts, DLQ, `pg_cron`
drain). **Deferred, not rejected:** the existing `jobs` table + a partial unique
index + Phase 2 writeback already covers enqueue/dedup/finalize without a second
queue abstraction. Revisit pgmq if we need retry/backoff with visibility
timeouts, scheduled re-drives, or fan-out to multiple independent workers.

## Implementation Plan

### Phase 1 — De-serialize the client + DB dedup + reload reconnect (in-repo only, no Modal change)

Delivers the headline win ("run lyrics + stems + analysis at once") with routes
still synchronous. Each route still holds a serverless function open until Modal
returns, but the *client* no longer blocks and duplicates are stopped.

- [x] **Dropped the global `running` mutex.** `running` is now a
      `ReadonlySet<string>` of in-flight stage names (`StudioClient.tsx:156`) with
      `beginStage`/`finishStage` helpers; every control reads
      `runningStages.has('<stage>')` so it disables only its own stage. (Built as a
      local per-stage set rather than "derived from the jobs list" — simpler and
      race-free for same-session fires; server state is layered on via reconnect.)
- [x] **Workflows fire without blocking siblings.** `runWorkflow` adds its stage to
      the set on start and removes it in `finally`; no shared flag, so stems +
      analysis + lyrics run concurrently.
- [x] **DB idempotency index + enqueue guard.** Migration
      `supabase/sql/2026-06-07_werecode_jobs_active_dedup.sql` adds a partial unique
      index `jobs_active_stage_dedup_idx (song_id, job_type) where status in
      ('queued','processing')` (with a defensive cleanup of any pre-existing dupes
      so it applies cleanly). `workflowContext` pre-checks for an active job, and the
      `23505` insert path is a race backstop; both raise a new `WorkflowConflictError`
      → HTTP 409 `workflow_already_running`. DEVIATION: chose **reject with a clear
      409** ("A … job is already running for this song.", surfaced via `fetchJson`)
      over "return the existing job" — minimal and centralized; the graceful
      cross-tab merge is a Phase 3 Realtime nicety. Stored-job replays
      (`existingJob`) bypass dedup.
- [x] **Reload reconnect.** On song mount, a bounded poll (`StudioClient.tsx`) reads
      `GET /api/jobs?songId=`, maps active `queued|processing` job types to stage
      names, and seeds a separate `reconnectingStages` set unioned with the local
      `running` set (so it never clobbers locally-fired stages). Polls every 4s while
      anything is active (~8-min ceiling) and force-reloads Studio detail when a
      reconnected job settles, to pull its artifacts.
- [x] `pnpm typecheck` + `pnpm lint` pass. Boot smoke: dev server compiles all
      touched modules with no errors, but route probes hang on the Supabase auth
      middleware in this sandbox (no session / outbound) — behavioral verification
      needs a real song fixture + auth, same constraint as prior phases.

### Phase 2 — True async execution (Option 2: Modal spawn + Next poll)

Decided via grill — **supersedes the original callback wording.** Removes the
held-open connection and the 5-min `maxDuration` cap. **Client-driven, user-session
— no service-role, no inbound callback, no public Next URL** (Next polls the
gateway, which is outbound and works in local dev). Flag-gated by
`WERECODE_MODAL_ASYNC`; sync stays the default everywhere.

Resolved design (grill): (a) client-driven completion; atomic claim column;
dedicated jobs columns + persist `finalize_spec`; centralize stage persist in
`finalizeJobFromModal` keyed by `pipelineStage`; header signal + `call_id` on
responses + one `run_job` worker; gateway `GET /jobs/{call_id}` poll.

WereCode side (this repo):
- [x] **Split `runJobWithModal`** → `finalizeJobFromModal({ supabase, job, modal,
      outputSpecs, songId, pipelineStage })`; takes the client as a param.
- [x] **Centralized stage persist** into `finalizeJobFromModal` keyed by
      `pipelineStage` (analyze → `persistAnalysisResults`, lyrics_align →
      `persistAlignedLyrics`); `runAnalyze`/`runLyricsAlign` simplified to
      `return runJobWithModal(...)`.
- [x] **Migration** `2026-06-07_werecode_jobs_async_columns.sql` adds
      `modal_call_id`, `finalize_spec`, `finalize_claimed_at` (+ partial index).
- [x] **Async enqueue** — `runJobWithModal` sends `X-WereCode-Async` when
      `WERECODE_MODAL_ASYNC` is on; on an `accepted` response `finalizeJobFromModal`
      stashes `modal_call_id` + `finalize_spec` and leaves the job `processing`.
- [x] **`finalizeStoredJob(jobId)`** — polls the gateway `GET /jobs/{call_id}`,
      single-finalizes via the `finalize_claimed_at` atomic claim (null or >2 min
      stale; two narrow updates avoid a PostgREST `or()` over a timestamp), then
      runs `finalizeJobFromModal` with the stored spec + polled result. Exposed at
      `POST /api/jobs/[jobId]/sync` (user-session, ownership-checked).
- [x] **Client** — the reconnect poll calls `/sync` per active job (in-flight
      guarded); `runWorkflow` keeps the stage busy and bumps a poll nonce on an
      `accepted` enqueue so in-session async jobs advance without a flicker.
- [x] `pnpm typecheck` + `pnpm lint` pass.

Modal gateway side (`…/personal/modal_apis/music_transcription_stack`):
- [x] `run_job` spawnable worker; `dispatch_engine_job`; the 4 endpoints spawn on
      the header + return `accepted` + `call_id`; `GET /jobs/{call_id}` poll;
      `call_id` on the 4 response models. `py_compile` + contract tests (9/9) pass.
      See that repo's `execution_docs/2026-06-07_async-spawn-poll-gateway.md`.

To ship (manual; all reversible, async stays off until the flag is set):
- [ ] Run `supabase/sql/2026-06-07_werecode_jobs_async_columns.sql` against Supabase.
- [ ] `modal deploy gateway_service/main.py` in the Modal repo.
- [ ] Set `WERECODE_MODAL_ASYNC=1` (Vercel; and local `.env` to test). Default off.
- [ ] End-to-end with a real song: enqueue → `accepted` → poll → assets land;
      confirm parallel stages no longer hold connections open.

### Phase 3 — Realtime + progress polish

- [ ] Subscribe to `werecode.jobs` via **Supabase Realtime** (filtered by owner /
      song) to replace polling with push; patch the cache on insert/update.
- [ ] Surface `job.progress` on each stage pill; keep polling as the fallback when
      Realtime is unavailable.
- [ ] `pnpm typecheck` + `pnpm lint` + boot smoke.

## Acceptance Criteria

- Starting stem separation no longer disables Analyze / Fetch lyrics / Align;
  multiple stages run at once and each pill reflects only its own state.
- Triggering the same stage twice (double-click, or a second tab) results in
  **one** job, not two (DB index converges them).
- Reloading Studio mid-run shows the stage still in progress and lands the result
  when it finishes (no lost work, no duplicate run).
- After Phase 2, the enqueue request returns in ~ms (no 5-min held connection),
  and a stem job longer than 5 min completes (no `maxDuration` truncation).
- After Phase 3, completion updates the UI via Realtime push without a manual
  refresh.

## Testing

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] Concurrency: fire stems + analysis + lyrics on one song; all three progress
      and complete independently.
- [ ] Dedup: double-click a stage and trigger the same stage from a second tab →
      exactly one job row; `force` while active is rejected cleanly.
- [ ] Reload survival: start a stage, hard-reload → still shown in progress →
      result lands.
- [ ] Phase 2: enqueue latency is ms; >5-min job finalizes via callback.

## Risks

- **Phase 2 is cross-boundary.** Modal endpoints + writeback live outside this
  repo; the internal completion route and service-role finalize are the in-repo
  half. Phase 1 deliberately ships value without touching Modal.
- **Service-role finalize bypasses RLS** — must scope every write to the job's
  `owner_id` and verify the callback secret; treat the completion route as a
  privileged surface.
- **Dedup vs. legitimate re-run.** The partial unique index blocks a *concurrent*
  second run of a stage; an intentional re-run must wait for the active one to
  reach a terminal state. Surface this, don't silently drop.
- **Polling cost** (Phase 1) until Realtime lands — bound the interval and stop
  when no active jobs remain.
- **Editing the ~3400-line `StudioClient`** — preserve existing in-flight Studio
  UI work; keep changes scoped to the run/gating path.

## Progress Log

### 2026-06-07

Action: Audited the current pipeline (client `running` mutex, synchronous
`/api/workflows/*` routes, `runJobWithModal` async-tail handling, `jobs` schema,
`runStoredJob`, `maybeSkipIfFresh`). Evaluated CloudAMQP vs. pgmq vs. Modal-native
async against the Next/Supabase/Modal runtime split.
Result: Chose Option A (Modal-native async, jobs table as queue, DB dedup index).
Documented the CloudAMQP rejection rationale and the deferred pgmq option. This
phased plan written; awaiting approval to begin Phase 1 (in-repo only).

---

Action: Implemented Phase 1 after approval. Server: added `WorkflowConflictError`
(`route-error.ts`, 409 `workflow_already_running`) and an enqueue dedup guard in
`workflowContext` (`modal-workflows.ts`) backed by a new partial-unique-index
migration (`2026-06-07_werecode_jobs_active_dedup.sql`). Client: replaced the single
`running` mutex in `StudioClient.tsx` with a per-stage `ReadonlySet<string>`
(`beginStage`/`finishStage`), rewrote ~30 `Boolean(running)` / `running === 'X'`
sites to per-stage `runningStages.has('X')`, and added a bounded reload-reconnect
poll that unions server-active stages with the local set.
Result: Stages run concurrently; a duplicate trigger (double-click, second tab,
reload-then-retry) converges on one job via the DB index → 409 with a clear message.
`pnpm typecheck` + `pnpm lint` clean; dev server compiles the touched modules with no
errors (route probes hang on the auth middleware in-sandbox — no SSR error observed).
Phase 2 (Modal async + service-role writeback) and Phase 3 (Realtime + progress)
pending. Manual step to ship: run the new SQL migration against Supabase.

---

Action: Started Phase 2 with the one safe, in-repo, behavior-preserving step —
extracted `finalizeJobFromModal` from `runJobWithModal` (`modal-workflows.ts`).
Result: A reusable terminal half a Modal completion callback can invoke with a
service-role client; the sync path is unchanged. typecheck + lint pass. PAUSED
before the rest of Phase 2 (callback route, async route cutover, client
poll-after-fire) — it is security-sensitive (a privileged Modal→Next callback +
RLS-bypassing finalize) and externally blocked: the Modal app that must return
`202 accepted` and call back is not in this repo, so the remainder can't be verified
in-repo and would regress in-session UX (a fired stage flickers idle) if shipped
before Modal + the client poll-after-fire land together. Awaiting direction on the
Modal boundary.

---

Action: Grilled the Phase 2 design and switched the approach from callback to
**Option 2 (Modal spawn + Next poll)** — client-driven, user-session, no
service-role, works in local dev. Implemented end-to-end across both repos:
WereCode (jobs async-columns migration, `finalizeJobFromModal` centralization +
async call-id/spec stash, `finalizeStoredJob` + `/api/jobs/[jobId]/sync`, atomic
finalize claim, client `/sync` poll + keep-busy on accepted, `WERECODE_MODAL_ASYNC`
flag) and the Modal gateway (`run_job` spawnable worker, `dispatch_engine_job`,
header-gated spawn + `accepted`/`call_id` on 4 endpoints, `GET /jobs/{call_id}`
poll, `call_id` on 4 response models).
Result: WereCode typecheck + lint clean; Modal gateway py_compile + contract tests
(9/9) clean. Async is flag-gated (default off → sync everywhere) and the gateway
ignores the header until redeployed, so everything is safe to land before the ship
steps. Remaining: run both SQL migrations, `modal deploy gateway_service/main.py`,
set `WERECODE_MODAL_ASYNC=1`, verify e2e with a real song.

## References

- `src/features/studio/StudioClient.tsx` (`running` mutex `:156`, `runWorkflow`
  `:481`, button gates `:1009/:1166/:1545/:1600/:2191`)
- `src/server/werecode/modal-workflows.ts` (`runStoredJob` `:125`,
  `runJobWithModal` async tail `:745`–`:789`, `modalFetch` `:729`)
- `src/lib/modal/client.ts` (HTTP gateway to the deployed Modal FastAPI app)
- `src/app/api/workflows/*/route.ts`, `src/app/api/jobs/[jobId]/run/route.ts`,
  `src/app/api/jobs/route.ts`
- `supabase/sql/2026-05-25_werecode_schema.sql:133` (`jobs` table, status `:157`)
- `src/features/pipeline/PipelineClient.tsx:302` (`activeJobs` derivation)
- Prior: `docs/execution_docs/2026-06-07_studio_cache_persistence_egress.md`
</content>
</invoke>

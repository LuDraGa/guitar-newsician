# Execution Doc: Failed Modal jobs stuck showing "processing"

Date: 2026-06-08
Status: Implemented — `pnpm typecheck` + `eslint` clean. Pending: push to `main`.
Owner: Claude

## Symptom

In the Studio/analyze page, stages whose Modal call failed kept showing
**processing** forever instead of flipping to failed. Surfaced after the gateway
async-spawn hydration 500s (analyze/separate), but the underlying gap is general.

## Root cause

`runJobWithModal` (`src/server/werecode/modal-workflows.ts`) sets the job row to
`status: 'processing'` **before** POSTing to the Modal gateway. When the dispatch
POST throws (gateway 500, network error, etc.), `modalFetch` rejects, the API route
returns an error to the client — but **nothing moves the row off `processing`**.

In async mode a stranded job has no `modal_call_id`, and `finalizeStoredJob`
short-circuited on `!job.modal_call_id`, so the client poll had nothing to advance.
The row span `processing` indefinitely.

## Fix (all in `src/server/werecode/modal-workflows.ts`)

- **A — Cause.** Wrap the enqueue `modalFetch` in `runJobWithModal` in try/catch:
  on throw, flip the job to `failed` (with the error text as `error_message`) then
  rethrow so the route still surfaces the error. The status write is best-effort
  (`.catch(() => {})`) so it never masks the original failure.
- **B — Heal stranded rows.** `finalizeStoredJob` no longer bails on a missing
  `modal_call_id`. A `processing` job with no call id whose `started_at` is older
  than `STALE_ENQUEUE_MS` (60s — well above the sub-second enqueue window) is
  claimed and reconciled to `failed`. This auto-heals jobs already stuck from the
  earlier 500s on the next Studio poll (the poll syncs every processing job, not
  just those with a call id).
- **C — Surface the reason.** `pollModalJob` now carries the gateway's `error`
  field; on a polled `failed` with no `result`, it is threaded into a diagnostic so
  the finalized job shows *why* it failed instead of a bare "Modal job failed".

No schema changes. Sync path unchanged. Complementary to the gateway hydration fix:
the gateway fix stops the 500s; this fix guarantees any failure (past or future)
shows as failed instead of a stuck spinner.

## Testing

- [x] `pnpm typecheck` (Node 22) — clean.
- [x] `eslint src/server/werecode/modal-workflows.ts` — clean.
- [ ] Live: trigger a gateway failure → stage shows failed (not processing); an
      already-stuck row flips to failed within ~60s of the next poll.

## References

- `src/server/werecode/modal-workflows.ts` (`runJobWithModal`, `finalizeStoredJob`,
  `pollModalJob`, `STALE_ENQUEUE_MS`)
- Gateway side: `modal_apis/.../execution_docs/2026-06-08_async-spawn-hydration-fix.md`

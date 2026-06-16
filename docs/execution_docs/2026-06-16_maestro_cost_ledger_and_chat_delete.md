# Maestro cost ledger and chat deletion

|            |                     |
| ---------- | ------------------- |
| **Date**   | 2026-06-16          |
| **Status** | Implemented         |
| **Scope**  | Maestro dev UI only |

## Context

Maestro already receives token and cost usage from the local Python agent on each
`/chat` response. The usage lives under the assistant response trace:
`raw.usage` is the per-request summary, and `raw.usage_calls` is the individual
LiteLLM call list for that request.

Before this change, the browser kept conversation transcripts in
`localStorage` under `maestro:conversations:v1`. That meant cost was effectively
recoverable from saved assistant messages, but deleting a chat would also remove
the visible source of that cost.

## Change

- Added a browser-local cost ledger under `maestro:cost-ledger:v1`.
- Backfilled the ledger from existing saved Maestro conversations on page load.
- Added visible cost totals in `/app/maestro`:
  - current chat cost
  - selected song cost
  - all local Maestro cost
- Added per-song cost badges to the song list when usage exists.
- Added delete controls for old conversations in the History menu.

Deleting a chat removes only the transcript from `maestro:conversations:v1`.
Recorded cost entries stay in `maestro:cost-ledger:v1`, so song and all-time
totals still include deleted chats.

## Boundary

This is intentionally local to the existing dev surface. It does not introduce a
Supabase schema/table for Maestro chat history yet, and it does not move product
state into the local Python agent.

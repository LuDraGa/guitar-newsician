# Execution Doc: Pipeline Single-Viewport Redesign

## Goal

Make `/app/pipeline` usable as a landscape diagnostics workbench instead of a
tall dashboard. The page should use the full viewport width, keep the main
job/asset table and inspector visible together, and move overflow into internal
scroll regions.

## Scope

- Keep all Pipeline data loading, filtering, caching, job detail, JSON copy, and
  signed-download behavior unchanged.
- Treat Pipeline as a fixed-height app workbench in the shared shell.
- Replace the large hero and metric cards with a compact toolbar, counters, and
  a single filter rail.
- Make job/asset tables and the inspector independently scrollable.

## Implementation Notes

- `AppShell` includes `/app/pipeline` in the fixed-viewport shell layout and
  applies the actual 76px topbar offset to fixed workbench content.
- `PipelineClient` now uses a full-width, full-height workbench frame with:
  compact title/counters/search/refresh/tabs, dense filter controls, a
  `minmax(0, 1fr)` table panel, and a fixed-width detail panel on desktop.
- Job and asset lists use sticky headers inside internal scroll containers.
- Job and asset detail headers are tighter so payload/storage content gets most
  of the panel height.
- Job payload headers put the job type, duration, and status on the same compact
  line as the "Job payload" label. Endpoint is not repeated in the visible
  header or default metadata summary.
- Full song name and song ID are shown without truncation in click-to-copy rows.
  Full request/response/diagnostics remain available as collapsible JSON
  sections.
- Pipeline now syncs active jobs through `/api/jobs/[jobId]/sync`, matching the
  Studio reconnect path so async Modal jobs do not sit indefinitely in the
  visible `processing` state once their Modal call has settled.
- Stem-targeted jobs derive context from `request_payload.source_asset_id` and
  cached asset metadata. Job rows show `Stem: <label>`, and the detail header
  adds a copyable Stem/Source row with the full target asset ID.
- Open JSON sections have bounded `overflow: auto` bodies so long payloads can
  scroll inside the section instead of being visually clipped.

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] Browser check `/app/pipeline` desktop landscape
- [x] Browser check `/app/pipeline` narrow viewport
- [x] Browser check compact job payload header, song/song ID copy rows, and
  scrollable JSON body
- [x] Browser check active stem analysis syncs from `processing` to `ready`
  and shows the target stem in row/detail surfaces

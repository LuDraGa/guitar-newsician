'use client';

import { AlertTriangle, ChevronRight, Database, FileJson, Zap } from 'lucide-react';

/**
 * BriefCard: a stored Comprehension Graph brief node rendered as structured
 * comprehension instead of the loop's prose.
 *
 * The node arrives on the turn's trace (`brief_region`'s tool response IS the
 * stored node) so this surface needs no read endpoint of its own. Reading
 * order inside the card: summary, then song context (key conflict, tempo,
 * judge), then per-section Mix vs Guitar-focus. Dev depth (hedges, part rows,
 * per-claim evidence) stays behind native <details> disclosures; clicking a
 * part row or section meta opens the slide-over drawer with the JsonViewer.
 * Everything the node holds stays reachable; nothing is silently dropped.
 */

export type BriefNode = Record<string, unknown>;

type DrawerPayload = { title: string; subtitle: string; detail: unknown };

/** Pull every brief node out of a turn's trace actions. Error nodes (unknown
 * region) carry no `node_type` and are skipped; the prose answers those. */
export function extractBriefNodes(trace: Record<string, unknown> | null | undefined): BriefNode[] {
  const actions = Array.isArray(trace?.actions) ? (trace.actions as unknown[]) : [];
  const nodes: BriefNode[] = [];
  for (const action of actions) {
    const content = asRecord(asRecord(asRecord(action)?.response)?.content);
    if (content && content.node_type === 'section_role_brief') nodes.push(content);
  }
  return nodes;
}

const STATUS_ORDER: Record<string, number> = { active: 0, unmeasured_here: 1, unanalyzable: 2, silent: 3 };

export function BriefCard({
  node,
  currentPack,
  packStatus,
  onOpen,
  defaultOpen = true,
}: {
  node: BriefNode;
  /** The currently loaded fact pack (raw snake_case); its identity decides freshness. */
  currentPack: Record<string, unknown> | null;
  /** The read-only staleness signal (pack vs the song's inputs). */
  packStatus: { stale: boolean } | null;
  onOpen: (content: DrawerPayload) => void;
  /** Older turns render collapsed so the transcript stays scannable. */
  defaultOpen?: boolean;
}) {
  const region = asRecord(node.region);
  const data = asRecord(node.data);
  const interpretation = asRecord(node.interpretation);
  const confidence = asRecord(node.confidence);
  const sections = Array.isArray(data?.sections) ? (data.sections as unknown[]).map(asRecord) : [];
  const interpSections = Array.isArray(interpretation?.sections)
    ? (interpretation.sections as unknown[]).map(asRecord)
    : [];

  const recalled = node.source === 'graph_recall';
  const judged = interpretation?.status === 'ok';
  const overallConf = stringValue(confidence?.overall);

  // Freshness: the node is keyed to a pack identity; a rebuilt pack (or a song
  // whose inputs drifted past the pack itself) makes this brief history.
  const nodeKey = `v${String(node.pack_version)}|${String(node.pack_created_at)}`;
  const currentKey = currentPack ? `v${String(currentPack.version)}|${String(currentPack.created_at)}` : null;
  const packChanged = currentKey != null && nodeKey !== currentKey;
  const inputsStale = packStatus?.stale === true;
  const stale = packChanged || inputsStale;

  const key = asRecord(data?.key);
  const teachingKey = stringValue(asRecord(key?.teaching_key)?.label);
  const detectedKey = stringValue(asRecord(key?.detected_key)?.label);
  const keyConflict = key?.key_conflict === true;
  const tempo = asRecord(data?.tempo);
  const bpm = typeof tempo?.bpm === 'number' ? Math.round(tempo.bpm as number) : null;
  const judgeModel = stringValue(interpretation?.model)?.replace(/^openai\//, '') ?? null;

  return (
    <details open={defaultOpen} className="group/card surface-flat max-w-[94%] px-3 py-1">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-open/card:rotate-90" />
        <span className="text-[13px] font-semibold">{regionTitle(region)}</span>
        <span className="chip" title={recalled ? 'Served from the Comprehension Graph, no new judgment pass' : 'Computed fresh this turn and stored in the Comprehension Graph'}>
          {recalled ? <Database className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          {recalled ? 'Recalled' : 'Fresh'}
        </span>
        {overallConf && overallConf !== 'high' && (
          <span className="chip warn" title="Overall confidence, driven by identity, key, and tempo confidence">
            conf {overallConf}
          </span>
        )}
        {stale && (
          <span className="chip warn">
            <AlertTriangle className="h-3 w-3" />
            pack changed
          </span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onOpen({ title: 'brief node', subtitle: `${regionTitle(region)} · evidence per claim`, detail: node });
          }}
          className="ml-auto flex items-center gap-1 bg-transparent hover:underline"
          // The unlayered `button { font: inherit; color: inherit }` reset in
          // globals.css beats Tailwind's utility layer, so size/color go inline.
          style={{ fontSize: '11px', color: 'var(--muted)' }}
          title="Inspect the full stored node, including per-claim evidence paths"
        >
          <FileJson className="h-3.5 w-3.5" />
          Inspect node
        </button>
      </summary>

      <div className="flex flex-col gap-2 pb-3">
        {stale && (
          <p className="flex items-start gap-1.5 rounded-lg bg-[oklch(0.62_0.15_40_/_0.12)] px-2.5 py-1.5 text-[12px] leading-4">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warn)]" />
            {packChanged
              ? 'The fact pack was rebuilt after this brief. Re-ask to refresh it.'
              : 'This song changed since Maestro last studied it, so the pack behind this brief is behind too.'}
          </p>
        )}

        {!judged && (
          <p className="flex items-start gap-1.5 text-[12px] leading-4 text-[var(--muted)]">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Interpretation unavailable: this is the formula-only brief, not persisted; the next ask retries the judgment.
          </p>
        )}

        {stringValue(interpretation?.summary) && (
          <p className="max-w-[70ch] text-[13px] leading-5">{stringValue(interpretation?.summary)}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {teachingKey && <span className="chip">key {teachingKey}</span>}
          {keyConflict && detectedKey && (
            <span className="chip warn" title="Teaching and detected keys disagree">
              detected {detectedKey}
            </span>
          )}
          {bpm != null && <span className="chip mono">{bpm} bpm</span>}
          {judgeModel && (
            <span className="chip mono" title="Model that ran the single judgment pass">
              judged by {judgeModel}
            </span>
          )}
          <span className="chip" title={`Fact-pack identity this brief is keyed to: ${nodeKey}`}>
            v{String(node.pack_version)}
          </span>
        </div>

        {sections.map((section, index) => {
          if (!section) return null;
          const sectionIndex = section.section_index;
          const interp = interpSections.find((entry) => entry?.section_index === sectionIndex) ?? null;
          return (
            <BriefSection
              key={index}
              section={section}
              interp={interp}
              defaultOpen={index === 0}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </details>
  );
}

function BriefSection({
  section,
  interp,
  defaultOpen,
  onOpen,
}: {
  section: Record<string, unknown>;
  interp: Record<string, unknown> | null;
  defaultOpen: boolean;
  onOpen: (content: DrawerPayload) => void;
}) {
  const title = stringValue(section.section) ?? stringValue(section.label) ?? 'section';
  const timeRange = `${formatSeconds(section.start_sec)}–${formatSeconds(section.end_sec)}`;
  const parts = (Array.isArray(section.parts) ? (section.parts as unknown[]).map(asRecord) : [])
    .filter((part): part is Record<string, unknown> => part != null)
    .sort((a, b) => statusRank(a) - statusRank(b));
  const activeCount = parts.filter((part) => part.status === 'active').length;
  const genericCount = parts.filter((part) => part.generic_label === true).length;
  const hedges = Array.isArray(interp?.hedges) ? (interp.hedges as unknown[]).map(String) : [];
  const abstentions = Array.isArray(interp?.abstentions) ? (interp.abstentions as unknown[]).map(String) : [];
  const chords = asRecord(asRecord(section.mix)?.chords);

  return (
    <details open={defaultOpen} className="group/section rounded-lg" style={{ boxShadow: 'inset 0 0 0 1px var(--hair)' }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 shrink-0 text-[var(--muted)] transition-transform group-open/section:rotate-90" />
        <span className="text-[12px] font-semibold">{title}</span>
        <span className="mono tnum text-[10px] text-[var(--muted)]">
          #{String(section.section_index)} · {timeRange}
        </span>
        <span className="ml-auto mono tnum text-[10px] text-[var(--muted)]">
          {activeCount}/{parts.length} parts active
        </span>
      </summary>

      <div className="flex flex-col gap-2 px-2.5 pb-2.5">
        {stringValue(interp?.mix_story) && <BriefLine label="Mix" text={stringValue(interp?.mix_story)!} />}
        {stringValue(interp?.guitar_focus) && (
          <BriefLine label="Guitar focus" text={stringValue(interp?.guitar_focus)!} strong />
        )}

        {chords && (
          <button
            type="button"
            onClick={() =>
              onOpen({
                title: `${title} #${String(section.section_index)}`,
                subtitle: 'section source data · chords + part rows',
                detail: section,
              })
            }
            className="mono tnum self-start bg-transparent hover:underline"
            style={{ fontSize: '11px', color: 'var(--muted)' }}
            title="Inspect this section's chord progression and part rows"
          >
            {String(numberValue(chords.count) ?? '?')} chords · conf {stringValue(chords.confidence) ?? '?'}
            {chords.truncated === true ? ' · truncated' : ''} →
          </button>
        )}

        {(hedges.length > 0 || abstentions.length > 0) && (
          <details className="group/hedges">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3 w-3 transition-transform group-open/hedges:rotate-90" />
              <AlertTriangle className="h-3 w-3 text-[var(--warn)]" />
              {hedges.length} hedge{hedges.length === 1 ? '' : 's'} · {abstentions.length} unknown
              {abstentions.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1.5 pl-4">
              {hedges.map((hedge, i) => (
                <li key={`h${i}`} className="max-w-[70ch] text-[12px] leading-4 text-[var(--muted)]">
                  <span className="label">Hedge</span> {hedge}
                </li>
              ))}
              {abstentions.map((abstention, i) => (
                <li key={`a${i}`} className="max-w-[70ch] text-[12px] leading-4 text-[var(--muted)]">
                  <span className="label">Unknown</span> {abstention}
                </li>
              ))}
            </ul>
          </details>
        )}

        {parts.length > 0 && (
          <details className="group/parts">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3 w-3 transition-transform group-open/parts:rotate-90" />
              {parts.length} parts
              {genericCount > 0 ? ` · ${genericCount} generically labeled` : ''}
            </summary>
            <ul className="mt-1 flex flex-col divide-y divide-[var(--hair)]">
              {parts.map((part, i) => (
                <PartRow key={i} part={part} onOpen={onOpen} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

function PartRow({ part, onOpen }: { part: Record<string, unknown>; onOpen: (content: DrawerPayload) => void }) {
  const status = stringValue(part.status) ?? 'unknown';
  const generic = part.generic_label === true;
  const flagged = status === 'unmeasured_here' || status === 'unanalyzable';
  const label = stringValue(part.label) ?? 'part';
  const tags = Array.isArray(part.tags) ? (part.tags as unknown[]).join(', ') : '';
  const activity = asRecord(part.activity);
  const noteCount = numberValue(activity?.note_count);
  const conf = stringValue(activity?.confidence) ?? stringValue(part.identity_confidence);

  return (
    <li>
      <button
        type="button"
        onClick={() =>
          onOpen({
            title: `${label} · ${stringValue(part.role) ?? 'part'}`,
            subtitle: `part row · ${status} · evidence + confidence per claim`,
            detail: part,
          })
        }
        className="flex w-full items-center gap-2 rounded-md bg-transparent px-1.5 py-1.5 text-left transition hover:bg-[var(--card-2)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px]">
            {label}
            {tags && <span className="text-[var(--muted)]"> · {tags}</span>}
          </span>
          <span className="mono tnum block truncate text-[10px] text-[var(--muted)]">
            {stringValue(part.role) ?? '?'}
            {noteCount != null ? ` · ${noteCount} notes` : ''}
          </span>
        </span>
        {generic && (
          <AlertTriangle
            className="h-3 w-3 shrink-0 text-[var(--warn)]"
            aria-label="Generic label, identity hedged"
          />
        )}
        <span
          className={`shrink-0 text-[10px] ${
            status === 'active' ? 'text-[var(--live-ink)]' : flagged ? 'text-[var(--warn)]' : 'text-[var(--muted)]'
          }`}
        >
          {status}
        </span>
        {conf && conf !== 'high' && <span className="shrink-0 text-[10px] text-[var(--warn)]">conf {conf}</span>}
      </button>
    </li>
  );
}

function BriefLine({ label, text, strong }: { label: string; text: string; strong?: boolean }) {
  return (
    <p className={`max-w-[70ch] text-[12px] leading-5 ${strong ? 'font-medium' : ''}`}>
      <span className="label">{label}</span> {text}
    </p>
  );
}

/** "chorus ×4" beats "chorus, chorus, chorus, chorus": dedupe region labels
 * and count the repeats so the header stays scannable. */
function regionTitle(region: Record<string, unknown> | null): string {
  const labels = Array.isArray(region?.labels) ? (region.labels as unknown[]).map(String).filter(Boolean) : [];
  if (labels.length === 0) return `Brief · ${stringValue(region?.query) ?? 'region'}`;
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const parts = [...counts.entries()].map(([label, count]) => (count > 1 ? `${label} ×${count}` : label));
  return `Brief · ${parts.join(' + ')}`;
}

function statusRank(part: Record<string, unknown>): number {
  return STATUS_ORDER[stringValue(part.status) ?? ''] ?? 4;
}

function formatSeconds(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '?';
  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

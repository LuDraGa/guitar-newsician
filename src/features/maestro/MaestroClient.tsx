'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  DollarSign,
  Flag,
  Hammer,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { PillIcon, ReadinessChips } from '@/components/werecode/WereCodePrimitives';
import { BriefCard, extractBriefNodes } from '@/features/maestro/BriefCard';
import { JsonViewer } from '@/features/maestro/JsonViewer';
import { useWereCodeDataCache } from '@/lib/client-cache/werecode-data-cache';
import type { MaestroFactPack, MaestroFactPackStatus, MaestroTool, SongSummary } from '@/types/werecode-client';

/**
 * Maestro: the in-product guitar-learning coach (developer surface).
 *
 * Single-viewport, full-width workbench (no document scroll; each column scrolls
 * internally): a searchable song picker + fact-pack panel, the chat to the local
 * baseline agent (Next `/api/maestro/*` → `MAESTRO_AGENT_URL`) with per-song
 * conversation history (localStorage) and a credit-saving model selector, a
 * Runtime rail of the active turn's steps, and a Tools catalog. Runtime steps and
 * tools both open a dismissible right-side slide-over drawer. See
 * docs/execution_docs/2026-06-14_maestro-baseline-build.md.
 */

type ChatTrace = Record<string, unknown> | null;

type MessageFeedback = {
  verdict: 'up' | 'down';
  comment?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  trace?: ChatTrace;
  /** The user's thumbs verdict on this answer (persisted with the conversation). */
  feedback?: MessageFeedback;
};

type ChatConversation = {
  id: string;
  songId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type UsageSummary = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
};

type CostLedgerEntry = UsageSummary & {
  id: string;
  songId: string;
  conversationId: string;
  conversationTitle: string;
  assistantMessageIndex: number;
  model: string | null;
  createdAt: number;
  updatedAt: number;
};

type ModelOption = { id: string; name: string; hint: string };
type DrawerContent = { title: string; subtitle: string; detail: unknown } | null;

// OpenAI only for now. Ordered cheapest → most capable. `name` shows when the
// selector is collapsed; `hint` shows only in the open dropdown.
const PROVIDER = { id: 'openai', label: 'OpenAI' };
const OPENAI_MODELS: ModelOption[] = [
  { id: 'gpt-5.4-nano', name: 'Nano · 5.4', hint: 'Fastest, cheapest — quick tests, routing' },
  { id: 'gpt-5.4-mini', name: 'Mini · 5.4', hint: 'Fast, cheap — high-volume work' },
  { id: 'gpt-5.4', name: 'Normal · 5.4', hint: 'Balanced premium' },
  { id: 'gpt-5.5', name: 'Best · 5.5', hint: 'Flagship — hard agent work, analysis' },
  { id: 'gpt-5.5-pro', name: 'Best Pro · 5.5', hint: 'Max quality; most expensive' },
];
const DEFAULT_MODEL_ID = 'gpt-5.4-nano';

const SUGGESTED_PROMPTS = ['What key should I trust?', 'What sections are detected?', 'Transpose to G'];
const STORAGE_KEY = 'maestro:conversations:v1';
const COST_LEDGER_KEY = 'maestro:cost-ledger:v1';

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function loadConversations(): ChatConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(list: ChatConversation[]) {
  if (typeof window === 'undefined') return;
  const trimmed = list.slice(0, 40);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Over quota — keep only the most recent handful.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, 12)));
    } catch {
      /* give up silently; history is best-effort */
    }
  }
}

function loadCostLedger(): CostLedgerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COST_LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CostLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function saveCostLedger(entries: CostLedgerEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COST_LEDGER_KEY, JSON.stringify(entries));
  } catch {
    /* cost history is best-effort until it moves to durable storage */
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = (firstUser?.content ?? 'New chat').trim().replace(/\s+/g, ' ');
  return text.length > 48 ? `${text.slice(0, 48)}…` : text || 'New chat';
}

// Module-scope wrappers for non-deterministic calls so the component body stays
// pure (satisfies react-hooks/purity); these run only in handlers/effects.
function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowMs(): number {
  return Date.now();
}

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function MaestroClient() {
  const cachedSongs = useWereCodeDataCache((state) => state.songs);
  const songsLoaded = useWereCodeDataCache((state) => state.songsLoaded);
  const setCachedSongs = useWereCodeDataCache((state) => state.setSongs);
  const tools = useWereCodeDataCache((state) => state.maestroTools);
  const toolsLoaded = useWereCodeDataCache((state) => state.maestroToolsLoaded);
  const setCachedMaestroFactPack = useWereCodeDataCache((state) => state.setMaestroFactPack);
  const setCachedMaestroTools = useWereCodeDataCache((state) => state.setMaestroTools);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [loadingSongs, setLoadingSongs] = useState(!songsLoaded);
  const [query, setQuery] = useState('');

  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);

  const [factPack, setFactPack] = useState<MaestroFactPack | null>(null);
  const [factPackBusy, setFactPackBusy] = useState<'idle' | 'building' | 'loading'>('idle');
  const [factPackError, setFactPackError] = useState<string | null>(null);
  // Freshness: is the persisted pack still in sync with the song's inputs?
  const [factPackStatus, setFactPackStatus] = useState<MaestroFactPackStatus | null>(null);
  // The staleness the user chose to live with (its reasons key), so the blocking
  // send-confirm stops nagging until a *new* staleness appears or a rebuild lands.
  const [ackedReasons, setAckedReasons] = useState<string | null>(null);
  // A message held back by the blocking confirm (null = no confirm open).
  const [pendingStaleSend, setPendingStaleSend] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  // Open optional-note editor for a just-thumbed message (index into messages).
  const [feedbackDraft, setFeedbackDraft] = useState<{ index: number; text: string } | null>(null);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const [costLedger, setCostLedger] = useState<CostLedgerEntry[]>([]);

  const [toolsError, setToolsError] = useState<string | null>(null);

  const [pinnedTurn, setPinnedTurn] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<DrawerContent>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadLatestPack = useCallback(
    async (songId: string, options: { force?: boolean } = {}) => {
      const cached = useWereCodeDataCache.getState().maestroFactPacksBySongId[songId];
      if (!options.force && cached) {
        setFactPack(cached.factPack);
        setFactPackError(null);
        setFactPackBusy('idle');
        return;
      }

      setFactPack(null);
      setFactPackError(null);
      setFactPackBusy('loading');
      try {
        const response = await fetch(`/api/maestro/fact-pack/${songId}`, { cache: 'no-store' });
        if (response.status === 404 || response.status === 409) {
          setCachedMaestroFactPack(songId, null);
          return; // not built yet
        }
        if (!response.ok) throw new Error(await readError(response, 'Could not load the fact pack'));
        const body = await response.json();
        const nextFactPack = (body.factPack ?? null) as MaestroFactPack | null;
        setCachedMaestroFactPack(songId, nextFactPack);
        setFactPack(nextFactPack);
      } catch (error) {
        setFactPackError(error instanceof Error ? error.message : 'Could not load the fact pack');
      } finally {
        setFactPackBusy('idle');
      }
    },
    [setCachedMaestroFactPack]
  );

  // Cheap, read-only freshness check (no rebuild). Drives the stale banner + the
  // blocking send-confirm. Failures degrade silently to "no signal".
  const loadFactPackStatus = useCallback(async (songId: string) => {
    try {
      const response = await fetch(`/api/maestro/fact-pack/${songId}/status`, { cache: 'no-store' });
      if (!response.ok) {
        setFactPackStatus(null);
        return;
      }
      const body = await response.json();
      setFactPackStatus((body.status ?? null) as MaestroFactPackStatus | null);
    } catch {
      setFactPackStatus(null);
    }
  }, []);

  // Switching songs restores that song's most recent conversation (if any) and
  // loads its fact pack. Reads conversations via a ref so the callback stays
  // stable (the library-load effect depends on it).
  const selectSong = useCallback(
    (songId: string) => {
      setSelectedSongId(songId);
      const latest = conversationsRef.current
        .filter((c) => c.songId === songId)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setActiveConvId(latest?.id ?? null);
      setMessages(latest ? latest.messages : []);
      setInput('');
      setChatError(null);
      setPinnedTurn(null);
      setDrawer(null);
      setFeedbackDraft(null);
      // New song context: forget any prior staleness acknowledgement.
      setAckedReasons(null);
      setPendingStaleSend(null);
      void loadLatestPack(songId);
      void loadFactPackStatus(songId);
    },
    [loadLatestPack, loadFactPackStatus]
  );

  const loadSongs = useCallback(
    async (options: { force?: boolean } = {}) => {
      const cache = useWereCodeDataCache.getState();
      if (!options.force && cache.songsLoaded) {
        const ready = cache.songs.filter((song) => song.has_analysis);
        if (ready[0] && (!selectedSongId || !ready.some((song) => song.id === selectedSongId))) {
          selectSong(ready[0].id);
        }
        setLoadingSongs(false);
        return;
      }

      setLoadingSongs(true);
      setSongsError(null);
      try {
        const response = await fetch('/api/songs?limit=100', { cache: 'no-store' });
        if (!response.ok) throw new Error(await readError(response, 'Could not load library'));
        const body = (await response.json()) as { songs?: SongSummary[] };
        const nextSongs = body.songs ?? [];
        const ready = nextSongs.filter((song) => song.has_analysis);
        setCachedSongs(nextSongs);
        if (ready[0] && (!selectedSongId || !ready.some((song) => song.id === selectedSongId))) {
          selectSong(ready[0].id);
        }
      } catch (error) {
        setSongsError(error instanceof Error ? error.message : 'Could not load library');
      } finally {
        setLoadingSongs(false);
      }
    },
    [selectSong, selectedSongId, setCachedSongs]
  );

  // Library, narrowed to analysis-ready songs; auto-select the first.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSongs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSongs]);

  // Load persisted history + the tool catalog once on mount. We yield a microtask
  // before the first setState so it isn't a synchronous set-state-in-effect, and
  // so the (empty) SSR markup matches the first client paint before localStorage
  // is read. Conversations are persisted from the send handler, not an effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const loadedConversations = loadConversations();
      const loadedLedger = mergeCostLedgerEntries(loadCostLedger(), conversationsToCostLedger(loadedConversations));
      setConversations(loadedConversations);
      setCostLedger(loadedLedger);
      conversationsRef.current = loadedConversations;
      saveCostLedger(loadedLedger);
      if (useWereCodeDataCache.getState().maestroToolsLoaded) {
        return;
      }
      try {
        const response = await fetch('/api/maestro/tools', { cache: 'no-store' });
        if (!response.ok) throw new Error(await readError(response, 'Could not load tools'));
        const body = await response.json();
        if (!cancelled) setCachedMaestroTools(body.tools ?? []);
      } catch (error) {
        if (!cancelled) setToolsError(error instanceof Error ? error.message : 'Could not load tools');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCachedMaestroTools]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatBusy]);

  function loadConversation(id: string) {
    const conv = conversationsRef.current.find((c) => c.id === id);
    if (!conv) return;
    setActiveConvId(id);
    setMessages(conv.messages);
    setPinnedTurn(null);
    setDrawer(null);
    setChatError(null);
    setFeedbackDraft(null);
  }

  function newChat() {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
    setPinnedTurn(null);
    setDrawer(null);
    setChatError(null);
    setFeedbackDraft(null);
  }

  // Upsert + persist a conversation. Called from the send handler (not an effect)
  // so it never trips the set-state-in-effect rule.
  function upsertConversation(id: string, songId: string, msgs: ChatMessage[]): ChatConversation {
    const now = nowMs();
    const existing = conversationsRef.current.find((c) => c.id === id);
    const record: ChatConversation = existing
      ? { ...existing, messages: msgs, title: existing.title || deriveTitle(msgs), updatedAt: now }
      : { id, songId, title: deriveTitle(msgs), createdAt: now, updatedAt: now, messages: msgs };
    setConversations((prev) => {
      const prevExisting = prev.find((c) => c.id === id);
      const nextRecord = prevExisting
        ? { ...prevExisting, messages: msgs, title: prevExisting.title || deriveTitle(msgs), updatedAt: now }
        : { id, songId, title: deriveTitle(msgs), createdAt: now, updatedAt: now, messages: msgs };
      const next = prevExisting ? prev.map((c) => (c.id === id ? nextRecord : c)) : [nextRecord, ...prev];
      saveConversations(next);
      conversationsRef.current = next;
      return next;
    });
    return record;
  }

  function rememberConversationCosts(conversation: ChatConversation) {
    const entries = conversationToCostLedger(conversation);
    if (entries.length === 0) return;
    setCostLedger((prev) => {
      const next = mergeCostLedgerEntries(prev, entries);
      saveCostLedger(next);
      return next;
    });
  }

  function deleteConversation(id: string) {
    const conversation = conversationsRef.current.find((c) => c.id === id);
    if (!conversation) return;
    rememberConversationCosts(conversation);
    const confirmed = window.confirm('Delete this chat transcript? Its recorded cost stays in the totals.');
    if (!confirmed) return;

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      conversationsRef.current = next;
      return next;
    });

    if (activeConvId === id) {
      newChat();
    }
  }

  async function buildPack() {
    if (!selectedSongId) return;
    setFactPackError(null);
    setFactPackBusy('building');
    try {
      const response = await fetch('/api/maestro/fact-pack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ songId: selectedSongId }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not build the fact pack'));
      const body = await response.json();
      const nextFactPack = (body.factPack ?? null) as MaestroFactPack | null;
      setCachedMaestroFactPack(selectedSongId, nextFactPack);
      setFactPack(nextFactPack);
      // A fresh build clears the staleness; re-check so the banner disappears.
      setAckedReasons(null);
      void loadFactPackStatus(selectedSongId);
    } catch (error) {
      setFactPackError(error instanceof Error ? error.message : 'Could not build the fact pack');
    } finally {
      setFactPackBusy('idle');
    }
  }

  // Guard the send: if the pack is stale and the user hasn't acknowledged *this*
  // staleness, hold the message and open the blocking confirm instead of sending.
  function send(messageText: string) {
    const text = messageText.trim();
    if (!text || !selectedSongId || chatBusy) return;
    const reasonsKey = factPackStatus?.stale ? factPackStatus.reasons.join('|') : null;
    if (factPack && reasonsKey && reasonsKey !== ackedReasons) {
      setPendingStaleSend(text);
      return;
    }
    void runSend(text);
  }

  async function runSend(text: string) {
    if (!text || !selectedSongId || chatBusy) return;

    const convId = activeConvId ?? makeId();
    if (!activeConvId) setActiveConvId(convId);

    const history = messages.map(({ role, content }) => ({ role, content }));
    const withUser: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(withUser);
    upsertConversation(convId, selectedSongId, withUser); // persist the question
    setInput('');
    setChatError(null);
    setPinnedTurn(null);
    setChatBusy(true);
    try {
      const response = await fetch('/api/maestro/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          songId: selectedSongId,
          message: text,
          history,
          model: `${PROVIDER.id}/${modelId}`,
          // Conversation id doubles as the Langfuse session id, so a whole
          // conversation reads as one thread in the trace UI.
          sessionId: convId,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not reach Maestro'));
      const body = await response.json();
      const withAnswer: ChatMessage[] = [
        ...withUser,
        { role: 'assistant', content: body.content ?? '(no answer)', trace: body.raw ?? null },
      ];
      setMessages(withAnswer);
      rememberConversationCosts(upsertConversation(convId, selectedSongId, withAnswer));
      // The turn may have spanned a re-analysis; refresh the freshness signal.
      void loadFactPackStatus(selectedSongId);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Could not reach Maestro');
    } finally {
      setChatBusy(false);
    }
  }

  // Thumbs verdict + optional note, keyed to the turn's trace id. Optimistic:
  // the verdict paints immediately and persists with the conversation; the row
  // lands in werecode.maestro_feedback (RLS'd) and the route forwards a
  // best-effort Langfuse score. A failed POST rolls the verdict back.
  async function sendFeedback(index: number, verdict: 'up' | 'down', comment?: string) {
    const message = messages[index];
    const trace = message?.trace as Record<string, unknown> | null | undefined;
    const traceId = trace ? stringValue(trace.trace_id) : null;
    if (!message || !traceId || !selectedSongId || !activeConvId) return;
    const previous = message.feedback;
    const feedback: MessageFeedback = { verdict, ...(comment?.trim() ? { comment: comment.trim() } : {}) };
    const next = messages.map((m, i) => (i === index ? { ...m, feedback } : m));
    setMessages(next);
    upsertConversation(activeConvId, selectedSongId, next);
    try {
      const response = await fetch('/api/maestro/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          songId: selectedSongId,
          traceId,
          verdict,
          comment: feedback.comment,
          model: stringValue(trace?.model) ?? undefined,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not record feedback'));
    } catch (error) {
      const rolledBack = next.map((m, i) => (i === index ? { ...m, feedback: previous } : m));
      setMessages(rolledBack);
      upsertConversation(activeConvId, selectedSongId, rolledBack);
      setChatError(error instanceof Error ? error.message : 'Could not record feedback');
    }
  }

  // Resolve the blocking confirm: rebuild then send, or send anyway (and stop
  // nagging for this staleness).
  function updateAndSend() {
    const text = pendingStaleSend;
    setPendingStaleSend(null);
    if (!text) return;
    void (async () => {
      await buildPack();
      await runSend(text);
    })();
  }

  function skipAndSend() {
    const text = pendingStaleSend;
    const reasonsKey = factPackStatus?.stale ? factPackStatus.reasons.join('|') : null;
    setAckedReasons(reasonsKey);
    setPendingStaleSend(null);
    if (text) void runSend(text);
  }

  const songs = useMemo(() => cachedSongs.filter((song) => song.has_analysis), [cachedSongs]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.title.toLowerCase().includes(q) || (s.artist ?? '').toLowerCase().includes(q));
  }, [songs, query]);

  const selectedSong = useMemo(() => songs.find((s) => s.id === selectedSongId) ?? null, [songs, selectedSongId]);
  const songConversations = useMemo(
    () => conversations.filter((c) => c.songId === selectedSongId).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, selectedSongId]
  );
  const activeChatCost = useMemo(() => sumMessageCosts(messages), [messages]);
  const costBySongId = useMemo(() => groupCostsBySong(costLedger), [costLedger]);
  const selectedSongCost = selectedSongId ? (costBySongId[selectedSongId] ?? emptyCost()) : emptyCost();
  const totalCost = useMemo(() => sumCostEntries(costLedger), [costLedger]);
  const summary = useMemo(() => summarizeFactPack(factPack), [factPack]);
  const hasPack = Boolean(factPack);
  // Staleness surfacing: the banner is always shown while stale; the blocking
  // confirm (pendingStaleSend) is the escalation at send time.
  const showStaleBanner = Boolean(factPackStatus?.stale && hasPack);
  const staleReasons = factPackStatus?.reasons ?? [];

  const activeTurn = useMemo(() => {
    if (pinnedTurn != null && messages[pinnedTurn]?.trace) return pinnedTurn;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant' && messages[i].trace) return i;
    }
    return null;
  }, [messages, pinnedTurn]);
  const activeTrace = activeTurn != null ? (messages[activeTurn]?.trace ?? null) : null;
  const activeTurnLabel = useMemo(() => {
    if (activeTurn == null) return null;
    let n = 0;
    for (let i = 0; i <= activeTurn; i += 1) if (messages[i]?.role === 'assistant') n += 1;
    return `answer ${n}`;
  }, [messages, activeTurn]);

  const selectedModel = OPENAI_MODELS.find((m) => m.id === modelId) ?? OPENAI_MODELS[0];

  return (
    <div className="flex h-full w-full flex-col gap-3 py-3">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <span className="pill ghost sm">
          <PillIcon>
            <Sparkles className="h-3.5 w-3.5" />
          </PillIcon>
          Maestro workbench
          <span className="ml-1 rounded-full bg-[var(--card)] px-2 py-0.5 text-[11px] text-[var(--muted)]">dev</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--hair)] px-3 py-1.5 text-[13px]">
            <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Provider</span>
            {PROVIDER.label}
          </span>

          <Popover
            triggerClassName="flex items-center gap-2 rounded-full border border-[var(--hair)] bg-[var(--paper)] px-3 py-1.5 text-[13px] hover:border-[var(--accent)]"
            trigger={
              <>
                <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Model</span>
                <span className="font-medium">{selectedModel.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />
              </>
            }
            panelWidth="w-72"
          >
            {(close) => (
              <ul className="flex flex-col">
                {OPENAI_MODELS.map((model) => {
                  const active = model.id === modelId;
                  return (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setModelId(model.id);
                          close();
                        }}
                        className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-[var(--card)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium">{model.name}</span>
                          <span className="block text-[11px] leading-4 text-[var(--muted)]">{model.hint}</span>
                          <span className="block text-[10px] text-[var(--muted)]">{model.id}</span>
                        </span>
                        {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Popover>
        </div>
      </div>

      {/* Three columns, each scrolls internally */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(290px,340px)] gap-3">
        {/* Left rail: songs + fact pack */}
        <aside className="surface flex min-h-0 flex-col p-0">
          <div className="shrink-0 border-b border-[var(--hair)] p-3">
            <h2 className="display text-[12px] uppercase tracking-wide text-[var(--muted)]">Songs</h2>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or artist…"
                className="w-full rounded-full border border-[var(--hair)] bg-[var(--paper)] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingSongs ? (
              <p className="p-2 text-[13px] text-[var(--muted)]">Loading library…</p>
            ) : songsError ? (
              <p className="p-2 text-[13px] text-[var(--danger)]">{songsError}</p>
            ) : songs.length === 0 ? (
              <p className="p-2 text-[13px] leading-5 text-[var(--muted)]">
                No analysis-ready songs. Seed one with{' '}
                <code className="rounded bg-[var(--card)] px-1 py-0.5 text-[12px]">
                  node --env-file=.env scripts/seed-maestro-babyslakh.mjs
                </code>
                .
              </p>
            ) : filteredSongs.length === 0 ? (
              <p className="p-2 text-[13px] text-[var(--muted)]">No songs match “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filteredSongs.map((song) => {
                  const active = song.id === selectedSongId;
                  const songCost = costBySongId[song.id];
                  return (
                    <li key={song.id}>
                      <button
                        type="button"
                        onClick={() => selectSong(song.id)}
                        className="surface w-full p-2.5 text-left transition"
                        style={active ? { boxShadow: 'inset 0 0 0 1.5px var(--accent)' } : undefined}
                      >
                        <p className="display truncate text-[13px] leading-5">{song.title}</p>
                        {song.artist && (
                          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{song.artist}</p>
                        )}
                        <div className="mt-1.5 flex items-center justify-between gap-1.5">
                          <ReadinessChips
                            items={[
                              { label: 'Stems', ready: song.has_stems },
                              { label: 'MIDI', ready: song.has_midi },
                              { label: 'Analysis', ready: song.has_analysis },
                            ]}
                          />
                          {songCost && hasAnyUsage(songCost) && (
                            <span
                              className="chip shrink-0 text-[10px]"
                              title={`${formatTokens(songCost.totalTokens)} tokens tracked for this song`}
                            >
                              {formatUsd(songCost.costUsd)}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="max-h-[44%] shrink-0 overflow-y-auto border-t border-[var(--hair)] p-3">
            <div className="flex items-center justify-between">
              <h2 className="display text-[12px] uppercase tracking-wide text-[var(--muted)]">Fact pack</h2>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="pill ghost sm"
                  disabled={!selectedSongId || factPackBusy !== 'idle'}
                  onClick={() => {
                    if (!selectedSongId) return;
                    void loadLatestPack(selectedSongId, { force: true });
                    void loadFactPackStatus(selectedSongId);
                  }}
                  title="Load the latest persisted fact pack"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${factPackBusy === 'loading' ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  className="pill sm"
                  disabled={!selectedSongId || factPackBusy !== 'idle'}
                  onClick={buildPack}
                >
                  <Hammer className="h-3.5 w-3.5" />
                  {factPackBusy === 'building' ? 'Building…' : hasPack ? 'Rebuild' : 'Build'}
                </button>
              </div>
            </div>

            {factPackError && (
              <p className="mt-2 flex items-start gap-2 text-[12px] leading-5 text-[var(--danger)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {factPackError}
              </p>
            )}

            {summary ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <SummaryRow label="Teaching key" value={summary.teachingKey} icon />
                <SummaryRow label="Detected key" value={summary.detectedKey} />
                <SummaryRow label="Tempo" value={summary.tempo} />
                <SummaryRow label="Sections" value={summary.sections} />
                <SummaryRow label="Stems" value={summary.stems} />
                <SummaryRow label="Confidence" value={summary.confidence} />
                {summary.keyConflict && (
                  <p className="col-span-2 flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
                    <AlertTriangle className="h-3 w-3" />
                    Teaching and detected keys disagree.
                  </p>
                )}
              </dl>
            ) : (
              !factPackError && (
                <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                  {factPackBusy === 'loading' ? 'Loading…' : 'No fact pack yet. Build one to ground the coach.'}
                </p>
              )
            )}

            {factPack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
                  Inspect fact pack JSON
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-[var(--card)] p-2 text-[11px] leading-4">
                  {JSON.stringify(factPack, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </aside>

        {/* Center: chat */}
        <section className="surface flex min-h-0 flex-col p-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--hair)] px-4 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <PillIcon>
                <KeyRound className="h-3.5 w-3.5" />
              </PillIcon>
              <p className="display truncate text-[14px]">{selectedSong ? selectedSong.title : 'Maestro'}</p>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <CostPill label="Chat" total={activeChatCost} title="Current visible chat" />
                <CostPill label="Song" total={selectedSongCost} title="Selected song, including deleted chats" />
                <CostPill label="All" total={totalCost} title="All local Maestro chats, including deleted chats" icon />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Popover
                triggerClassName="flex items-center gap-1.5 rounded-full border border-[var(--hair)] px-3 py-1.5 text-[12px] hover:border-[var(--accent)] disabled:opacity-50"
                triggerDisabled={songConversations.length === 0}
                trigger={
                  <>
                    <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                    History
                    <span className="text-[var(--muted)]">{songConversations.length}</span>
                  </>
                }
                panelWidth="w-72"
              >
                {(close) => (
                  <ul className="flex max-h-72 flex-col overflow-y-auto">
                    {songConversations.map((conv) => {
                      const active = conv.id === activeConvId;
                      const convCost = sumMessageCosts(conv.messages);
                      return (
                        <li key={conv.id} className="group flex items-start gap-1 rounded-lg hover:bg-[var(--card)]">
                          <button
                            type="button"
                            onClick={() => {
                              loadConversation(conv.id);
                              close();
                            }}
                            className="flex min-w-0 flex-1 items-start gap-2 rounded-lg p-2 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px]">{conv.title}</span>
                              <span className="block text-[11px] text-[var(--muted)]">
                                {relTime(conv.updatedAt)} · {conv.messages.length} msgs
                                {hasAnyUsage(convCost) ? ` · ${formatUsd(convCost.costUsd)}` : ''}
                              </span>
                            </span>
                            {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteConversation(conv.id);
                              close();
                            }}
                            className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] opacity-70 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                            title="Delete chat"
                            aria-label={`Delete ${conv.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Popover>
              <button type="button" className="pill ghost sm" onClick={newChat} title="Start a new conversation">
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
          </div>

          {showStaleBanner && (
            <div className="flex shrink-0 items-start gap-2 border-b border-[var(--hair)] bg-[var(--accent-soft)] px-4 py-2.5 text-[12px] leading-5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--ink)]">
                  This song changed since Maestro last studied it.
                </p>
                {staleReasons.length > 0 && (
                  <p className="mt-0.5 text-[var(--muted)]">{staleReasons.join(' ')}</p>
                )}
              </div>
              <button
                type="button"
                className="pill sm shrink-0"
                disabled={factPackBusy !== 'idle'}
                onClick={buildPack}
                title="Rebuild the fact pack from the latest analysis"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${factPackBusy === 'building' ? 'animate-spin' : ''}`} />
                {factPackBusy === 'building' ? 'Updating…' : 'Update'}
              </button>
            </div>
          )}

          <div ref={transcriptRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !chatBusy && (
              <div className="text-[13px] leading-6 text-[var(--muted)]">
                <p>Ask about the key, sections, chords, tempo, or parts. Try:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chip"
                      disabled={!hasPack}
                      onClick={() => send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {!hasPack && <p className="mt-3 text-[12px]">Build the fact pack first to enable questions.</p>}
              </div>
            )}

            {messages.map((message, index) => {
              if (message.role === 'user') {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--ink)] px-4 py-2.5 text-[14px] leading-6 text-[var(--paper)]">
                      {message.content}
                    </div>
                  </div>
                );
              }
              const isActive = index === activeTurn;
              const traceId = message.trace ? stringValue((message.trace as Record<string, unknown>).trace_id) : null;
              const isDrafting = feedbackDraft?.index === index;
              const footerVisible = Boolean(message.feedback || isDrafting);
              // Structure first, narration second: a turn that briefed a region
              // renders the stored node as cards above the loop's prose.
              const briefNodes = extractBriefNodes(message.trace);
              return (
                <div key={index} className="group flex flex-col gap-1">
                  {briefNodes.map((node, nodeIndex) => (
                    <BriefCard
                      key={nodeIndex}
                      node={node}
                      currentPack={factPack}
                      packStatus={factPackStatus}
                      onOpen={setDrawer}
                      defaultOpen={index === messages.length - 1}
                    />
                  ))}
                  <div
                    className="markdown max-w-[94%] rounded-lg px-1 text-[14px] leading-7 [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--card)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h1]:mt-2 [&_h1]:text-[16px] [&_h2]:mt-2 [&_h2]:text-[15px] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--card)] [&_pre]:p-3 [&_pre]:text-[12px] [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--hair)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--hair)] [&_th]:bg-[var(--card)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                    style={isActive ? { boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 self-start overflow-hidden transition-[max-height,opacity] duration-150 ${
                      footerVisible
                        ? 'max-h-8 opacity-100'
                        : 'max-h-0 opacity-0 focus-within:max-h-8 focus-within:opacity-100 group-hover:max-h-8 group-hover:opacity-100 group-focus-within:max-h-8 group-focus-within:opacity-100'
                    }`}
                  >
                    {traceId && (
                      <>
                        <button
                          type="button"
                          aria-label="Good answer"
                          title="Good answer"
                          onClick={() => {
                            void sendFeedback(index, 'up', message.feedback?.comment);
                            setFeedbackDraft({ index, text: message.feedback?.comment ?? '' });
                          }}
                          className={`rounded-full p-1 transition-colors ${
                            message.feedback?.verdict === 'up'
                              ? 'bg-[var(--ink)] text-[var(--paper)]'
                              : 'bg-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Bad answer"
                          title="Bad answer"
                          onClick={() => {
                            void sendFeedback(index, 'down', message.feedback?.comment);
                            setFeedbackDraft({ index, text: message.feedback?.comment ?? '' });
                          }}
                          className={`rounded-full p-1 transition-colors ${
                            message.feedback?.verdict === 'down'
                              ? 'bg-[var(--ink)] text-[var(--paper)]'
                              : 'bg-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        {isDrafting && message.feedback ? (
                          <form
                            className="flex items-center gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void sendFeedback(index, message.feedback!.verdict, feedbackDraft.text);
                              setFeedbackDraft(null);
                            }}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={feedbackDraft.text}
                              onChange={(e) => setFeedbackDraft({ index, text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setFeedbackDraft(null);
                              }}
                              placeholder="What happened? (optional)"
                              maxLength={2000}
                              className="w-56 rounded-full border border-[var(--hair)] bg-[var(--paper)] px-2.5 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
                            />
                            <button type="submit" className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
                              Save
                            </button>
                          </form>
                        ) : (
                          message.feedback?.comment && (
                            <button
                              type="button"
                              title={message.feedback.comment}
                              onClick={() => setFeedbackDraft({ index, text: message.feedback?.comment ?? '' })}
                              className="max-w-56 truncate bg-transparent text-[11px] italic text-[var(--muted)] hover:text-[var(--ink)]"
                            >
                              “{message.feedback.comment}”
                            </button>
                          )
                        )}
                      </>
                    )}
                    {message.trace && !isActive && (
                      <button
                        type="button"
                        onClick={() => setPinnedTurn(index)}
                        className="bg-transparent text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        View runtime →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {chatBusy && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Maestro is thinking…
              </div>
            )}

            {chatError && (
              <p className="flex items-start gap-2 text-[13px] leading-5 text-[var(--danger)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {chatError}
              </p>
            )}
          </div>

          <form
            className="flex shrink-0 items-center gap-2 border-t border-[var(--hair)] px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasPack ? 'Ask Maestro about this song…' : 'Build the fact pack to begin'}
              disabled={!hasPack || chatBusy}
              className="flex-1 rounded-full border border-[var(--hair)] bg-[var(--paper)] px-4 py-2.5 text-[14px] outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
            <button type="submit" className="pill" disabled={!hasPack || chatBusy || !input.trim()}>
              <Send className="h-4 w-4" />
              Ask
            </button>
          </form>
        </section>

        {/* Right: runtime + tools, stacked */}
        <div className="flex min-h-0 flex-col gap-3">
          <RuntimeRail trace={activeTrace} turnLabel={activeTurnLabel} onOpen={setDrawer} />
          <ToolsPanel tools={tools} toolsLoaded={toolsLoaded} error={toolsError} onOpen={setDrawer} />
        </div>
      </div>

      <RuntimeDrawer content={drawer} onClose={() => setDrawer(null)} />

      {pendingStaleSend !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-[var(--ink)]/40"
            onClick={() => setPendingStaleSend(null)}
          />
          <div className="surface relative z-10 w-[min(420px,92vw)] p-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <h3 className="display text-[15px]">Fact pack is out of date</h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                  {staleReasons.length > 0
                    ? staleReasons.join(' ')
                    : 'The song changed since Maestro last studied it.'}{' '}
                  Update it so the coach answers from the latest analysis, or skip and answer from the
                  current pack.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="pill ghost sm" onClick={skipAndSend}>
                Skip &amp; send
              </button>
              <button
                type="button"
                className="pill sm"
                disabled={factPackBusy !== 'idle'}
                onClick={updateAndSend}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${factPackBusy === 'building' ? 'animate-spin' : ''}`} />
                {factPackBusy === 'building' ? 'Updating…' : 'Update & send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Popover({
  trigger,
  triggerClassName,
  triggerDisabled,
  panelWidth = 'w-64',
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName: string;
  triggerDisabled?: boolean;
  panelWidth?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={triggerDisabled} className={triggerClassName} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute right-0 z-30 mt-1 ${panelWidth} surface max-h-80 overflow-auto p-1 shadow-[var(--shadow-pop)]`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function RuntimeRail({
  trace,
  turnLabel,
  onOpen,
}: {
  trace: ChatTrace;
  turnLabel: string | null;
  onOpen: (content: DrawerContent) => void;
}) {
  const actions = Array.isArray(trace?.actions) ? (trace!.actions as Record<string, unknown>[]) : [];
  const calls = Array.isArray(trace?.usage_calls) ? (trace!.usage_calls as Record<string, unknown>[]) : [];
  const usage = asRecord(trace?.usage);
  const model = stringValue(trace?.model);
  const elapsed = typeof trace?.elapsed_ms === 'number' ? (trace.elapsed_ms as number) : null;
  // Soft cost guard: the agent flags a turn whose cost exceeded MAESTRO_TURN_BUDGET_USD.
  const budget = asRecord(trace?.budget);
  const overBudget = budget?.over === true;
  const budgetLimit = typeof budget?.limit_usd === 'number' ? (budget.limit_usd as number) : null;

  return (
    <aside className="surface flex min-h-0 flex-1 flex-col p-0">
      <div className="shrink-0 border-b border-[var(--hair)] px-3 py-2.5">
        <h2 className="display text-[12px] uppercase tracking-wide text-[var(--muted)]">
          Runtime{turnLabel ? ` · ${turnLabel}` : ''}
        </h2>
        {trace ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {model && <span className="chip">{model}</span>}
            {usage?.total_tokens != null && (
              <span className="chip">{Number(usage.total_tokens).toLocaleString()} tok</span>
            )}
            {usage?.cost_usd != null && (
              <span
                className="chip"
                style={
                  overBudget
                    ? { borderColor: 'var(--danger)', color: 'var(--danger)' }
                    : undefined
                }
                title={
                  overBudget && budgetLimit != null
                    ? `Over the ${formatUsd(budgetLimit)} per-turn budget (MAESTRO_TURN_BUDGET_USD)`
                    : undefined
                }
              >
                {formatUsd(Number(usage.cost_usd))}
                {overBudget && budgetLimit != null ? ` · over ${formatUsd(budgetLimit)} budget` : ''}
              </span>
            )}
            {elapsed != null && <span className="chip">{(elapsed / 1000).toFixed(1)}s</span>}
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-[var(--muted)]">Ask something to see the agent’s steps.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {actions.length > 0 && (
          <>
            <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">Steps</p>
            <ul className="flex flex-col gap-1">
              {actions.map((action, index) => (
                <li key={stringValue(action.id) ?? index}>
                  <RuntimeRow
                    icon={actionIcon(stringValue(action.kind))}
                    name={stringValue(action.name) ?? 'step'}
                    meta={stringValue(action.kind) ?? 'tool'}
                    status={stringValue(action.status) ?? undefined}
                    onClick={() =>
                      onOpen({
                        title: stringValue(action.name) ?? 'step',
                        subtitle: `${stringValue(action.kind) ?? 'tool'} · ${stringValue(action.status) ?? 'complete'}`,
                        detail: action,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {calls.length > 0 && (
          <>
            <p className="px-1 pb-1 pt-3 text-[10px] uppercase tracking-wide text-[var(--muted)]">Model calls</p>
            <ul className="flex flex-col gap-1">
              {calls.map((call, index) => (
                <li key={index}>
                  <RuntimeRow
                    icon={Cpu}
                    name={stringValue(call.model) ?? 'model call'}
                    meta={`${call.total_tokens ?? '?'} tok`}
                    status={call.latency_ms != null ? `${Math.round(Number(call.latency_ms))}ms` : undefined}
                    onClick={() =>
                      onOpen({ title: stringValue(call.model) ?? 'model call', subtitle: 'model call', detail: call })
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {trace && actions.length === 0 && calls.length === 0 && (
          <p className="p-2 text-[12px] text-[var(--muted)]">No tool steps — the model answered directly.</p>
        )}
      </div>
    </aside>
  );
}

function CostPill({
  label,
  total,
  title,
  icon,
}: {
  label: string;
  total: UsageSummary;
  title: string;
  icon?: boolean;
}) {
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--hair)] bg-[var(--paper)] px-2.5 py-1 text-[11px]"
      title={`${title}: ${formatUsd(total.costUsd)}, ${formatTokens(total.totalTokens)}, ${total.calls} calls`}
    >
      {icon && <DollarSign className="h-3 w-3 shrink-0 text-[var(--muted)]" />}
      <span className="uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="font-medium">{formatUsd(total.costUsd)}</span>
    </span>
  );
}

function ToolsPanel({
  tools,
  toolsLoaded,
  error,
  onOpen,
}: {
  tools: MaestroTool[];
  toolsLoaded: boolean;
  error: string | null;
  onOpen: (content: DrawerContent) => void;
}) {
  return (
    <aside className="surface flex max-h-[42%] min-h-0 shrink-0 flex-col p-0">
      <div className="shrink-0 border-b border-[var(--hair)] px-3 py-2.5">
        <h2 className="display text-[12px] uppercase tracking-wide text-[var(--muted)]">
          Tools{tools.length > 0 ? ` · ${tools.length}` : ''}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? (
          <p className="p-2 text-[12px] text-[var(--danger)]">{error}</p>
        ) : tools.length === 0 ? (
          <p className="p-2 text-[12px] text-[var(--muted)]">
            {toolsLoaded ? 'No tools available.' : 'Loading tools…'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tools.map((tool) => (
              <li key={tool.name}>
                <RuntimeRow
                  icon={Wrench}
                  name={tool.name}
                  meta={
                    tool.params.length === 0
                      ? 'no params'
                      : `${tool.params.length} param${tool.params.length > 1 ? 's' : ''}`
                  }
                  onClick={() => onOpen({ title: tool.name, subtitle: 'tool', detail: tool })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function RuntimeRow({
  icon: Icon,
  name,
  meta,
  status,
  onClick,
}: {
  icon: typeof Wrench;
  name: string;
  meta: string;
  status?: string;
  onClick: () => void;
}) {
  const danger = status === 'error';
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface flex w-full items-center gap-2 p-2 text-left transition hover:shadow-[var(--shadow-card)]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px]">{name}</span>
        <span className="block truncate text-[10px] uppercase tracking-wide text-[var(--muted)]">{meta}</span>
      </span>
      {status && (
        <span className={`shrink-0 text-[10px] ${danger ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
          {status}
        </span>
      )}
    </button>
  );
}

function RuntimeDrawer({ content, onClose }: { content: DrawerContent; onClose: () => void }) {
  const open = Boolean(content);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const description =
    content && asRecord(content.detail) && typeof asRecord(content.detail)!.description === 'string'
      ? (asRecord(content.detail)!.description as string)
      : null;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[var(--ink)] transition-opacity duration-200 ${
          open ? 'opacity-25' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* A floating, inset bench card rather than a full-bleed slab: rounded
          `surface` with the elevated pop shadow, margined off every edge. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detail"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        className={`surface fixed bottom-3 right-3 top-3 z-50 flex w-[min(380px,92vw)] flex-col overflow-hidden transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-[120%]'
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--hair)] px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] leading-4 uppercase tracking-wide text-[var(--muted)]">{content?.subtitle}</p>
            <p className="display mt-0.5 truncate text-[16px] leading-5">{content?.title}</p>
          </div>
          <button type="button" onClick={onClose} className="iconbtn shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {description && <p className="mb-3 text-[13px] leading-6 text-[var(--ink-2)]">{description}</p>}
          {content && <JsonViewer data={content.detail} />}
        </div>
      </aside>
    </>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {icon && <KeyRound className="h-3 w-3" />}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function actionIcon(kind: string | null): typeof Wrench {
  if (kind === 'subagent') return Users;
  if (kind === 'final') return Flag;
  return Wrench;
}

function emptyCost(): UsageSummary {
  return { calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
}

function hasAnyUsage(total: UsageSummary): boolean {
  return total.costUsd > 0 || total.totalTokens > 0 || total.calls > 0;
}

function usageFromTrace(trace: ChatTrace): UsageSummary | null {
  const usage = asRecord(trace?.usage);
  if (!usage) return null;

  const summary: UsageSummary = {
    calls: numberValue(usage.calls) ?? 0,
    promptTokens: numberValue(usage.prompt_tokens) ?? 0,
    completionTokens: numberValue(usage.completion_tokens) ?? 0,
    totalTokens: numberValue(usage.total_tokens) ?? 0,
    costUsd: numberValue(usage.cost_usd) ?? 0,
  };

  return hasAnyUsage(summary) ? summary : null;
}

function conversationToCostLedger(conversation: ChatConversation): CostLedgerEntry[] {
  return conversation.messages.flatMap((message, index) => {
    if (message.role !== 'assistant') return [];
    const usage = usageFromTrace(message.trace ?? null);
    if (!usage) return [];
    return [
      {
        id: `${conversation.id}:${index}`,
        songId: conversation.songId,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        assistantMessageIndex: index,
        model: stringValue(message.trace?.model),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        ...usage,
      },
    ];
  });
}

function conversationsToCostLedger(conversations: ChatConversation[]): CostLedgerEntry[] {
  return conversations.flatMap(conversationToCostLedger);
}

function mergeCostLedgerEntries(existing: CostLedgerEntry[], additions: CostLedgerEntry[]): CostLedgerEntry[] {
  if (additions.length === 0) return existing;
  const byId = new Map<string, CostLedgerEntry>();
  for (const entry of existing) byId.set(entry.id, entry);
  for (const entry of additions) byId.set(entry.id, { ...byId.get(entry.id), ...entry });
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function sumMessageCosts(messages: ChatMessage[]): UsageSummary {
  return messages.reduce((total, message) => addUsage(total, usageFromTrace(message.trace ?? null)), emptyCost());
}

function sumCostEntries(entries: CostLedgerEntry[]): UsageSummary {
  return entries.reduce((total, entry) => addUsage(total, entry), emptyCost());
}

function groupCostsBySong(entries: CostLedgerEntry[]): Record<string, UsageSummary> {
  return entries.reduce<Record<string, UsageSummary>>((acc, entry) => {
    acc[entry.songId] = addUsage(acc[entry.songId] ?? emptyCost(), entry);
    return acc;
  }, {});
}

function addUsage(total: UsageSummary, usage: UsageSummary | null): UsageSummary {
  if (!usage) return total;
  return {
    calls: total.calls + usage.calls,
    promptTokens: total.promptTokens + usage.promptTokens,
    completionTokens: total.completionTokens + usage.completionTokens,
    totalTokens: total.totalTokens + usage.totalTokens,
    costUsd: roundCost(total.costUsd + usage.costUsd),
  };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.0000';
  if (value < 0.0001) return '<$0.0001';
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  return `${Math.round(value).toLocaleString()} tok`;
}

type FactPackSummary = {
  teachingKey: string;
  detectedKey: string;
  tempo: string;
  sections: string;
  stems: string;
  confidence: string;
  keyConflict: boolean;
};

function summarizeFactPack(pack: MaestroFactPack | null): FactPackSummary | null {
  if (!pack) return null;
  const key = asRecord(pack.key);
  const tempo = asRecord(pack.tempo);
  const confidence = asRecord(pack.confidence);
  const song = asRecord(pack.song);
  const sections = Array.isArray(pack.sections) ? pack.sections : [];
  const stems = Array.isArray(song?.stems) ? (song!.stems as unknown[]) : [];

  const teaching = asRecord(key?.teaching_key);
  const detected = asRecord(key?.detected_key);
  const bpm = tempo?.bpm;

  return {
    teachingKey: stringValue(teaching?.label) ?? '—',
    detectedKey: stringValue(detected?.label) ?? '—',
    tempo: typeof bpm === 'number' ? `${Math.round(bpm)} bpm` : '—',
    sections: String(sections.length),
    stems: String(stems.length),
    confidence: stringValue(confidence?.overall) ?? '—',
    keyConflict: key?.key_conflict === true,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

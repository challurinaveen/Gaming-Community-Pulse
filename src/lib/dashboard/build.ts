import { collectAll } from "@/lib/collectors";
import type { RawRecord } from "@/lib/collectors/types";
import { getSampleData } from "@/lib/sample-data";
import { GAMES } from "@/lib/config/games";
import { enrichRecords, summarize, type AnalysisSummary, type EnrichedRecord, type Platform } from "@/lib/analysis/pipeline";
import { enabledPlatforms } from "@/lib/platforms";
import { detectSpikes } from "@/lib/analysis/patterns";
import { generateBriefing, type Briefing } from "@/lib/ai/briefing";
import { clusterGameDiscussion, isGeminiConfigured, type GameClusters } from "@/lib/ai/clustering";
import { activeLLM } from "@/lib/ai/llm";
import { isSupabaseConfigured, type DailySnapshot } from "@/lib/db/supabase";
import { getRecentSnapshots, saveSnapshot, pruneOldSnapshots } from "@/lib/db/snapshots";
import { saveRecords, type NewCommunityRecord } from "@/lib/db/records";

export const RETENTION_DAYS = 90;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RECORD_CHUNK = 500;

export type DashboardRecord = Omit<EnrichedRecord, "rawData">;

export interface PlatformProvenance {
  platform: Platform;
  configured: boolean;
  liveRecords: number;
  sampleRecords: number;
  error?: string;
}

export interface LiveViewers {
  game: string;
  name: string;
  viewers: number;
  streams: number;
  isSample: boolean;
}

export interface VolumeSpike {
  game: string;
  name: string;
  date: string;
  count: number;
  baseline: number;
  magnitude: number;
}

export interface Comparison {
  previousDate: string;
  avgSentiment: number;
  volume24h: number;
  riskCount: number;
  games: Record<string, { avgSentiment: number; volume24h: number }>;
}

export interface StorageStatus {
  mode: "supabase" | "none";
  durable: boolean;
  retention_days: number;
  last_write: { saved: boolean; mode: "supabase" | "none"; at: string | null; records?: number; error?: string };
}

export interface DashboardPayload {
  generatedAt: string;
  date: string;
  summary: AnalysisSummary;
  /** Platforms enabled on this server (DISABLED_PLATFORMS removes the rest everywhere). */
  platforms: Platform[];
  records: DashboardRecord[];
  provenance: PlatformProvenance[];
  liveViewers: LiveViewers[];
  spikes: VolumeSpike[];
  comparison: Comparison | null;
  briefing: Briefing;
  clusters: GameClusters[];
  engines: { sentiment: string; briefing: string; clustering: string };
  storage: StorageStatus;
}

let lastWrite: StorageStatus["last_write"] = { saved: false, mode: "none", at: null };

export function getStorageStatus(): StorageStatus {
  const configured = isSupabaseConfigured();
  return { mode: configured ? "supabase" : "none", durable: configured, retention_days: RETENTION_DAYS, last_write: lastWrite };
}

const isStream = (r: RawRecord) => r.platform === "twitch" && r.rawData.type === "stream";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function liveViewerSnapshot(streams: RawRecord[]): LiveViewers[] {
  return GAMES.map((g) => {
    const rs = streams.filter((s) => s.game === g.id);
    return {
      game: g.id,
      name: g.name,
      viewers: rs.reduce((sum, s) => sum + num(s.rawData.view_count), 0),
      streams: rs.length,
      isSample: rs.length > 0 && rs.every((s) => s.isSample),
    };
  });
}

type GameSnap = { records: number; volume24h: number; avgSentiment: number; avgEngagement: number; riskCount: number };

function snapshotGames(snap: DailySnapshot): Record<string, GameSnap> {
  return (snap.games_summary ?? {}) as Record<string, GameSnap>;
}

function detectVolumeSpikes(summary: AnalysisSummary, history: DailySnapshot[], today: string): VolumeSpike[] {
  const past = history.filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date));
  const spikes: VolumeSpike[] = [];
  for (const g of summary.games) {
    const series = [
      ...past.map((s) => ({ date: s.date, count: num(snapshotGames(s)[g.game]?.volume24h) })),
      { date: today, count: g.volume24h },
    ];
    for (const s of detectSpikes(series)) {
      spikes.push({ game: g.game, name: g.name, date: s.date, count: s.count, baseline: s.mean, magnitude: s.magnitude });
    }
  }
  return spikes.sort((a, b) => b.date.localeCompare(a.date) || b.magnitude - a.magnitude);
}

function compare(summary: AnalysisSummary, previous: DailySnapshot | null): Comparison | null {
  if (!previous) return null;
  const prev = (previous.overall ?? {}) as Record<string, unknown>;
  const prevGames = snapshotGames(previous);
  return {
    previousDate: previous.date,
    avgSentiment: Math.round((summary.overall.avgSentiment - num(prev.avgSentiment)) * 10) / 10,
    volume24h: summary.overall.volume24h - num(prev.volume24h),
    riskCount: summary.risks.riskCount - previous.risk_count,
    games: Object.fromEntries(
      summary.games
        .filter((g) => prevGames[g.game])
        .map((g) => [
          g.game,
          {
            avgSentiment: Math.round((g.avgSentiment - num(prevGames[g.game].avgSentiment)) * 10) / 10,
            volume24h: g.volume24h - num(prevGames[g.game].volume24h),
          },
        ])
    ),
  };
}

function toSnapshot(date: string, s: AnalysisSummary): Omit<DailySnapshot, "generated_at"> {
  return {
    date,
    overall: s.overall as unknown as Record<string, unknown>,
    games_summary: Object.fromEntries(
      s.games.map((g) => [g.game, { records: g.records, volume24h: g.volume24h, avgSentiment: g.avgSentiment, avgEngagement: g.avgEngagement, riskCount: g.riskCount }])
    ),
    platform_summary: Object.fromEntries(s.platforms.map((p) => [p.platform, p])),
    region_summary: Object.fromEntries(s.regions.map((r) => [r.region, r])),
    themes: { themes: s.themes },
    risk_count: s.risks.riskCount,
  };
}

function toArchiveRow(r: EnrichedRecord): NewCommunityRecord {
  return {
    platform: r.platform,
    source_id: r.id,
    game: r.game,
    author: r.author,
    content: r.content,
    raw_data: r.rawData,
    sentiment_score: r.sentiment.score,
    sentiment_confidence: r.sentiment.confidence,
    sentiment_engine: r.sentiment.engine,
    sarcasm_flag: r.sentiment.sarcasm,
    theme: r.sentiment.theme,
    is_question: r.sentiment.isQuestion,
    is_risk: r.sentiment.isRisk,
    engagement_index: r.engagement.index,
    region: r.region.region,
    region_confidence: r.region.confidence,
    published_at: r.publishedAt,
  };
}

/** Only genuinely collected data is stored; sample rows never reach the snapshot history or archive. */
async function persist(date: string, live: EnrichedRecord[]): Promise<void> {
  const at = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    lastWrite = { saved: false, mode: "none", at, error: "Supabase is not configured" };
    return;
  }
  if (live.length === 0) {
    lastWrite = { saved: false, mode: "supabase", at, error: "No live records to store (all platforms on sample data)" };
    return;
  }
  try {
    await saveSnapshot(toSnapshot(date, summarize(live, new Date(), enabledPlatforms())));
    for (let i = 0; i < live.length; i += RECORD_CHUNK) {
      await saveRecords(live.slice(i, i + RECORD_CHUNK).map(toArchiveRow));
    }
    await pruneOldSnapshots(RETENTION_DAYS);
    lastWrite = { saved: true, mode: "supabase", at, records: live.length };
  } catch (error) {
    console.error("[storage] write failed", error);
    lastWrite = { saved: false, mode: "supabase", at, error: error instanceof Error ? error.message : String(error) };
  }
}

async function build(): Promise<DashboardPayload> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  // 1. COLLECT — live data, then labelled sample data for any enabled platform that returned nothing live.
  const active = enabledPlatforms();
  const { records: collected, platforms: status } = await collectAll();
  const livePlatforms = new Set(collected.filter((r) => !isStream(r)).map((r) => r.platform));
  const samples = getSampleData().filter((s) => active.includes(s.platform) && !livePlatforms.has(s.platform));
  const liveStreams = collected.filter(isStream);
  const streams = liveStreams.length ? liveStreams : samples.filter(isStream);
  const community = [...collected, ...samples].filter((r) => !isStream(r));

  // 2–3. ENRICH + AGGREGATE
  const enriched = await enrichRecords(community);
  const live = enriched.filter((r) => !r.isSample);
  const summary = summarize(enriched, now, active);

  // 4. COMPARE against stored history
  let history: DailySnapshot[] = [];
  try {
    history = await getRecentSnapshots(30);
  } catch (error) {
    console.error("[storage] could not read snapshot history", error);
  }
  const previous = history.find((s) => s.date < date) ?? null;
  const comparison = compare(summary, previous);
  const spikes = detectVolumeSpikes(summary, history, date);

  // 5. BRIEF — LLM narrative and Gemini clustering in parallel. Clustering sees live records only.
  const [briefing, clusters] = await Promise.all([
    // Whole numbers only, so the briefing quotes the same figures the dashboard shows.
    generateBriefing({
      date,
      totalRecords: summary.overall.totalRecords,
      samplePercent: Math.round(summary.overall.sampleShare * 100),
      avgSentiment: Math.round(summary.overall.avgSentiment),
      avgEngagement: Math.round(summary.overall.avgEngagement),
      games: summary.games.map((g) => ({ name: g.name, records: g.records, avgSentiment: Math.round(g.avgSentiment), topTheme: g.topThemes[0]?.theme ?? null })),
      platforms: summary.platforms.map((p) => ({ platform: p.platform, records: p.records, avgSentiment: Math.round(p.avgSentiment) })),
      themes: summary.themes.slice(0, 8).map((t) => ({ ...t, avgSentiment: Math.round(t.avgSentiment) })),
      riskCount: summary.risks.riskCount,
      riskyThemes: summary.risks.riskyThemes.map((t) => t.theme),
      spikes: spikes.filter((s) => s.date === date).map((s) => ({ date: `${s.name} ${s.date}`, count: s.count, mean: Math.round(s.baseline) })),
      topQuestions: summary.questions.slice(0, 5).map((q) => ({ question: q.representative.slice(0, 200), count: q.count })),
      previous: previous
        ? {
            date: previous.date,
            totalRecords: num((previous.overall as Record<string, unknown> | null)?.totalRecords),
            avgSentiment: Math.round(num((previous.overall as Record<string, unknown> | null)?.avgSentiment)),
            riskCount: previous.risk_count,
          }
        : null,
    }),
    Promise.all(
      GAMES.map((g) =>
        clusterGameDiscussion(
          g.name,
          live
            .filter((r) => r.game === g.id)
            .sort((a, b) => b.engagement.index - a.engagement.index)
            .map((r) => ({ id: r.id, content: r.content, platform: r.platform, author: r.author, url: r.url ?? undefined, sentimentScore: r.sentiment.score }))
        )
      )
    ),
  ]);

  await persist(date, live);

  // 6. SERVE
  const llm = activeLLM();
  return {
    generatedAt: now.toISOString(),
    date,
    summary,
    records: enriched.map(({ rawData: _raw, ...r }) => r),
    platforms: active,
    provenance: active.map((platform) => {
      const s = status.find((p) => p.platform === platform);
      return {
        platform,
        configured: s?.configured ?? false,
        liveRecords: live.filter((r) => r.platform === platform).length,
        sampleRecords: enriched.filter((r) => r.isSample && r.platform === platform).length,
        error: s?.error,
      };
    }),
    liveViewers: liveViewerSnapshot(streams),
    spikes,
    comparison,
    briefing,
    clusters,
    engines: {
      sentiment: llm ? `${llm.label} + lexicon fallback` : "Lexicon only",
      briefing: briefing.model ?? "Template",
      clustering: isGeminiConfigured() ? "Gemini (grounded selection)" : "Not configured",
    },
    storage: getStorageStatus(),
  };
}

let cached: { payload: DashboardPayload; expires: number } | null = null;
let inFlight: Promise<DashboardPayload> | null = null;

/** Runs the full pipeline, serving a cached result for a few minutes unless `force` is set. Concurrent callers share one run. */
export async function getDashboard({ force = false } = {}): Promise<DashboardPayload> {
  if (!force && cached && cached.expires > Date.now()) return cached.payload;
  inFlight ??= build()
    .then((payload) => {
      cached = { payload, expires: Date.now() + CACHE_TTL_MS };
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

import type { RawRecord } from "@/lib/collectors/types";
import { GAMES } from "@/lib/config/games";
import { analyzeSentiment, analyzeSentimentLexicon, type SentimentResult } from "@/lib/analysis/sentiment";
import { calculateEngagement, type EngagementResult } from "@/lib/analysis/engagement";
import { classifyRegion, type RegionResult } from "@/lib/analysis/region";
import { detectLanguage } from "@/lib/analysis/language";
import {
  aggregateThemes,
  detectRisks,
  clusterQuestions,
  type ThemeAggregate,
  type RiskSummary,
  type QuestionCluster,
} from "@/lib/analysis/patterns";

import { PLATFORMS, type Platform } from "@/lib/platforms";

export { PLATFORMS, type Platform };

const MAX_SCORING_CHARS = 1500;
const TIMELINE_DAYS = 30;
const MIN_POSTS_FOR_DAILY_AVG = 3;
const POSITIVE = 20;
const NEGATIVE = -20;

export interface EnrichedRecord {
  id: string;
  platform: Platform;
  game: string;
  author: string;
  content: string;
  url: string | null;
  publishedAt: string;
  isSample: boolean;
  sentiment: Omit<SentimentResult, "id">;
  engagement: EngagementResult;
  region: RegionResult;
  rawData: Record<string, unknown>;
}

export interface SentimentSplit {
  positive: number;
  neutral: number;
  negative: number;
}

export interface GameSummary {
  game: string;
  name: string;
  records: number;
  /** Records published in the 24h before collection; comparable day to day because pull sizes are fixed. */
  volume24h: number;
  avgSentiment: number;
  avgEngagement: number;
  split: SentimentSplit;
  topThemes: ThemeAggregate[];
  riskCount: number;
  platforms: Record<Platform, number>;
}

export interface PlatformSummary {
  platform: Platform;
  records: number;
  avgSentiment: number;
  avgEngagement: number;
}

export interface RegionSummary {
  region: string;
  records: number;
  avgSentiment: number;
  avgConfidence: number;
}

export interface TimelinePoint {
  date: string;
  count: number;
  avgSentiment: number | null;
}

export interface AnalysisSummary {
  overall: {
    totalRecords: number;
    volume24h: number;
    liveRecords: number;
    sampleRecords: number;
    sampleShare: number;
    avgSentiment: number;
    avgEngagement: number;
    split: SentimentSplit;
    sarcasmCount: number;
    questionCount: number;
    semanticShare: number;
  };
  games: GameSummary[];
  platforms: PlatformSummary[];
  regions: RegionSummary[];
  themes: ThemeAggregate[];
  risks: RiskSummary;
  questions: QuestionCluster[];
  timeline: TimelinePoint[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function split(records: EnrichedRecord[]): SentimentSplit {
  const out = { positive: 0, neutral: 0, negative: 0 };
  for (const r of records) {
    if (r.sentiment.score > POSITIVE) out.positive++;
    else if (r.sentiment.score < NEGATIVE) out.negative++;
    else out.neutral++;
  }
  return out;
}

function groupBy<K extends string>(records: EnrichedRecord[], key: (r: EnrichedRecord) => K): Map<K, EnrichedRecord[]> {
  const groups = new Map<K, EnrichedRecord[]>();
  for (const r of records) {
    const k = key(r);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  return groups;
}

/**
 * Scores every record. Live records go through the semantic engine (with lexicon fallback);
 * sample records are never sent to a model; they get the deterministic lexicon only.
 */
export async function enrichRecords(records: RawRecord[]): Promise<EnrichedRecord[]> {
  const live = records.filter((r) => !r.isSample && r.content.trim());
  const scored = await analyzeSentiment(live.map((r) => ({ id: r.sourceId, content: r.content.slice(0, MAX_SCORING_CHARS) })));
  const byId = new Map(scored.map((s) => [s.id, s]));

  return records
    .filter((r) => r.content.trim())
    .map((r) => {
      const s = byId.get(r.sourceId) ?? analyzeSentimentLexicon(r.content.slice(0, MAX_SCORING_CHARS));
      const { id: _ignored, ...sentiment } = s;
      const rawData = withRegionSignals(r);
      return {
        id: r.sourceId,
        platform: r.platform,
        game: r.game,
        author: r.author,
        content: r.content,
        url: typeof r.rawData.url === "string" ? r.rawData.url : null,
        publishedAt: r.publishedAt.toISOString(),
        isSample: r.isSample,
        sentiment,
        engagement: calculateEngagement(r.platform, r.rawData),
        region: classifyRegion(r.platform, rawData),
        rawData,
      };
    });
}

/**
 * Adds the two region signals the collectors don't supply: a region configured for the source
 * (signal 2) and the language detected from the text (signal 5). classifyRegion applies the precedence.
 */
function withRegionSignals(r: RawRecord): Record<string, unknown> {
  const configuredRegion = GAMES.find((g) => g.id === r.game)?.sourceRegions?.[r.platform];
  const detectedLanguage = detectLanguage(r.content.slice(0, MAX_SCORING_CHARS));
  return {
    ...r.rawData,
    ...(configuredRegion ? { configuredRegion } : {}),
    ...(detectedLanguage ? { detectedLanguage } : {}),
  };
}

function buildTimeline(records: EnrichedRecord[], now = new Date()): TimelinePoint[] {
  const days: TimelinePoint[] = [];
  const byDay = groupBy(records, (r) => r.publishedAt.slice(0, 10));
  for (let i = TIMELINE_DAYS - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const day = byDay.get(date) ?? [];
    // An average of one or two posts is noise; leave the point blank rather than plot a misleading swing.
    days.push({ date, count: day.length, avgSentiment: day.length >= MIN_POSTS_FOR_DAILY_AVG ? round1(mean(day.map((r) => r.sentiment.score))) : null });
  }
  return days;
}

export function summarize(records: EnrichedRecord[], now = new Date(), activePlatforms: Platform[] = PLATFORMS): AnalysisSummary {
  const isLast24h = (r: EnrichedRecord) => now.getTime() - Date.parse(r.publishedAt) <= 86_400_000;
  const sampleRecords = records.filter((r) => r.isSample).length;
  const nameOf = new Map(GAMES.map((g) => [g.id, g.name]));
  const themeInput = records.map((r) => ({ theme: r.sentiment.theme, score: r.sentiment.score }));
  const timeline = buildTimeline(records, now);

  const games: GameSummary[] = GAMES.map((g) => {
    const rs = records.filter((r) => r.game === g.id);
    const platforms = Object.fromEntries(PLATFORMS.map((p) => [p, rs.filter((r) => r.platform === p).length])) as Record<Platform, number>;
    return {
      game: g.id,
      name: nameOf.get(g.id) ?? g.id,
      records: rs.length,
      volume24h: rs.filter(isLast24h).length,
      avgSentiment: round1(mean(rs.map((r) => r.sentiment.score))),
      avgEngagement: round1(mean(rs.map((r) => r.engagement.index))),
      split: split(rs),
      topThemes: aggregateThemes(rs.map((r) => ({ theme: r.sentiment.theme, score: r.sentiment.score }))).slice(0, 3),
      riskCount: rs.filter((r) => r.sentiment.isRisk).length,
      platforms,
    };
  });

  const platforms: PlatformSummary[] = activePlatforms.map((platform) => {
    const rs = records.filter((r) => r.platform === platform);
    return {
      platform,
      records: rs.length,
      avgSentiment: round1(mean(rs.map((r) => r.sentiment.score))),
      avgEngagement: round1(mean(rs.map((r) => r.engagement.index))),
    };
  });

  const regions: RegionSummary[] = [...groupBy(records, (r) => r.region.region)]
    .map(([region, rs]) => ({
      region,
      records: rs.length,
      avgSentiment: round1(mean(rs.map((r) => r.sentiment.score))),
      avgConfidence: Math.round(mean(rs.map((r) => r.region.confidence)) * 100) / 100,
    }))
    .sort((a, b) => b.records - a.records);

  return {
    overall: {
      totalRecords: records.length,
      volume24h: records.filter(isLast24h).length,
      liveRecords: records.length - sampleRecords,
      sampleRecords,
      sampleShare: records.length ? Math.round((sampleRecords / records.length) * 1000) / 1000 : 0,
      avgSentiment: round1(mean(records.map((r) => r.sentiment.score))),
      avgEngagement: round1(mean(records.map((r) => r.engagement.index))),
      split: split(records),
      sarcasmCount: records.filter((r) => r.sentiment.sarcasm).length,
      questionCount: records.filter((r) => r.sentiment.isQuestion).length,
      semanticShare: records.length ? round1((records.filter((r) => r.sentiment.engine === "semantic").length / records.length) * 100) / 100 : 0,
    },
    games,
    platforms,
    regions,
    themes: aggregateThemes(themeInput),
    risks: detectRisks(records.map((r) => ({ id: r.id, isRisk: r.sentiment.isRisk, theme: r.sentiment.theme, score: r.sentiment.score }))),
    questions: clusterQuestions(records.map((r) => ({ id: r.id, content: r.content, isQuestion: r.sentiment.isQuestion }))).slice(0, 10),
    timeline,
  };
}

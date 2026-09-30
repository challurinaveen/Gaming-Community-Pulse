// ---------------------------------------------------------------------------
// Pattern detection – spikes, theme aggregation, risks, question clustering
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Spike {
  date: string;
  count: number;
  mean: number;
  threshold: number;
  magnitude: number; // how many standard deviations above the mean
}

export interface ThemeAggregate {
  theme: string;
  count: number;
  avgSentiment: number;
}

export interface RiskSummary {
  riskCount: number;
  riskyThemes: { theme: string; avgSentiment: number; count: number }[];
  topRiskRecords: { id: string; theme: string; score: number }[];
}

export interface QuestionCluster {
  representative: string; // longest question in the cluster
  count: number;
  questionIds: string[];
}

// ---------------------------------------------------------------------------
// Spike detection
// ---------------------------------------------------------------------------

/**
 * Detect spikes in a time series using a trailing window of 7 data points.
 *
 * A data point is flagged as a spike when its count exceeds
 * mean + 2 * stddev of the preceding 7 points.
 */
export function detectSpikes(
  timeSeries: { date: string; count: number }[]
): Spike[] {
  if (timeSeries.length < 2) return [];

  const spikes: Spike[] = [];
  const WINDOW = 7;

  const MIN_BASELINE = 3;

  for (let i = MIN_BASELINE; i < timeSeries.length; i++) {
    const windowStart = Math.max(0, i - WINDOW);
    const window = timeSeries.slice(windowStart, i);

    const mean =
      window.reduce((sum, p) => sum + p.count, 0) / window.length;

    const variance =
      window.reduce((sum, p) => sum + (p.count - mean) ** 2, 0) /
      window.length;
    const stddev = Math.sqrt(variance);

    // A perfectly flat baseline has stddev 0; fall back to "more than double the mean" so a jump still registers.
    const threshold = stddev > 0 ? mean + 2 * stddev : mean * 2;
    const current = timeSeries[i];

    if (current.count > threshold && current.count >= 3) {
      spikes.push({
        date: current.date,
        count: current.count,
        mean: Number(mean.toFixed(2)),
        threshold: Number(threshold.toFixed(2)),
        magnitude: Number((stddev > 0 ? (current.count - mean) / stddev : current.count / Math.max(mean, 1)).toFixed(2)),
      });
    }
  }

  return spikes;
}

// ---------------------------------------------------------------------------
// Theme aggregation
// ---------------------------------------------------------------------------

/**
 * Count and average sentiment per theme, sorted by count descending.
 */
export function aggregateThemes(
  records: { theme: string; score: number }[]
): ThemeAggregate[] {
  const map = new Map<
    string,
    { total: number; count: number }
  >();

  for (const r of records) {
    const entry = map.get(r.theme) ?? { total: 0, count: 0 };
    entry.total += r.score;
    entry.count += 1;
    map.set(r.theme, entry);
  }

  const aggregates: ThemeAggregate[] = [];
  for (const [theme, { total, count }] of map) {
    aggregates.push({
      theme,
      count,
      avgSentiment: Number((total / count).toFixed(1)),
    });
  }

  aggregates.sort((a, b) => b.count - a.count);
  return aggregates;
}

// ---------------------------------------------------------------------------
// Risk detection
// ---------------------------------------------------------------------------

/**
 * Summarise risk across records:
 * - Count records individually flagged as risks
 * - Flag themes where average sentiment < -30
 * - Return the top 10 highest-risk records (most negative score, flagged as risk)
 */
/** A theme needs at least this many posts before its average can flag it as a risk. */
const MIN_THEME_POSTS = 3;

export function detectRisks(
  records: { id?: string; isRisk: boolean; theme: string; score: number }[]
): RiskSummary {
  // Count flagged risk records
  const riskRecords = records.filter((r) => r.isRisk);

  // Theme-level risk: average sentiment < -30
  const themeMap = new Map<
    string,
    { total: number; count: number }
  >();
  for (const r of records) {
    const entry = themeMap.get(r.theme) ?? { total: 0, count: 0 };
    entry.total += r.score;
    entry.count += 1;
    themeMap.set(r.theme, entry);
  }

  const riskyThemes: RiskSummary["riskyThemes"] = [];
  for (const [theme, { total, count }] of themeMap) {
    const avg = total / count;
    if (avg < -30 && count >= MIN_THEME_POSTS) {
      riskyThemes.push({
        theme,
        avgSentiment: Number(avg.toFixed(1)),
        count,
      });
    }
  }
  riskyThemes.sort((a, b) => a.avgSentiment - b.avgSentiment);

  // Top risk records (most negative first)
  const topRiskRecords = riskRecords
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((r) => ({
      id: r.id ?? "",
      theme: r.theme,
      score: r.score,
    }));

  return {
    riskCount: riskRecords.length,
    riskyThemes,
    topRiskRecords,
  };
}

// ---------------------------------------------------------------------------
// Question clustering
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "about",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "each",
  "every",
  "all",
  "any",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "because",
  "if",
  "when",
  "while",
  "how",
  "what",
  "where",
  "who",
  "which",
  "why",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "them",
  "their",
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Cluster questions by Jaccard token similarity > 0.3.
 *
 * Uses single-pass greedy assignment: for each question, find the first
 * existing cluster whose representative has similarity > 0.3. If none
 * match, create a new cluster.
 *
 * Returns clusters sorted by size (descending), each with a representative
 * question (the longest in the cluster).
 */
export function clusterQuestions(
  records: { id: string; content: string; isQuestion: boolean }[]
): QuestionCluster[] {
  const questions = records.filter((r) => r.isQuestion);
  if (questions.length === 0) return [];

  const THRESHOLD = 0.3;

  // Each cluster: { tokens, members: {id, content}[] }
  const clusters: {
    tokens: Set<string>;
    members: { id: string; content: string }[];
  }[] = [];

  for (const q of questions) {
    const tokens = tokenize(q.content);
    let assigned = false;

    for (const cluster of clusters) {
      if (jaccardSimilarity(tokens, cluster.tokens) > THRESHOLD) {
        cluster.members.push({ id: q.id, content: q.content });
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push({
        tokens,
        members: [{ id: q.id, content: q.content }],
      });
    }
  }

  // Build output: representative is the longest question in each cluster
  const result: QuestionCluster[] = clusters.map((c) => {
    const longest = c.members.reduce((a, b) =>
      b.content.length > a.content.length ? b : a
    );
    return {
      representative: longest.content,
      count: c.members.length,
      questionIds: c.members.map((m) => m.id),
    };
  });

  result.sort((a, b) => b.count - a.count);
  return result;
}

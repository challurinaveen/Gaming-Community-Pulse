import { callClaude, CLAUDE_MODEL } from "@/lib/ai/claude";

export interface BriefingInput {
  date: string;
  totalRecords: number;
  /** Whole-number percentage (0-100) of today's records that are illustrative sample data. */
  samplePercent: number;
  avgSentiment: number;
  avgEngagement: number;
  games: { name: string; records: number; avgSentiment: number; topTheme: string | null }[];
  platforms: { platform: string; records: number; avgSentiment: number }[];
  themes: { theme: string; count: number; avgSentiment: number }[];
  riskCount: number;
  riskyThemes: string[];
  spikes: { date: string; count: number; mean: number }[];
  topQuestions: { question: string; count: number }[];
  previous: { date: string; totalRecords: number; avgSentiment: number; riskCount: number } | null;
}

export interface Briefing {
  text: string;
  engine: "ai" | "template";
  /** Which model wrote it, e.g. "Claude (claude-opus-5)"; null for the template. */
  model: string | null;
  generatedAt: string;
}

const SYSTEM = `You write the daily community briefing for a gaming marketing agency. Readers are non-technical marketing staff who will spend under a minute on it.

Write one or two short paragraphs of plain prose, 150-200 words in total and never more than 200 (no headings, no bullet lists, no markdown). Lead with the single most important thing that needs attention, then cover only the two or three other points a marketer would act on. Do not walk through every game, platform or theme.

Use figures sparingly: at most about eight numbers in the whole briefing, written exactly as they appear in the data (whole numbers; sentiment as a signed score such as +12 or -30 on a -100 to +100 scale). Every number you mention must appear in the data.

If "previous" is null, there is no prior snapshot: do not describe any change over time, trends, or day-over-day movement. If samplePercent is above 0, end with one short sentence saying that samplePercent% of today's records are illustrative sample data.`;

export async function generateBriefing(input: BriefingInput): Promise<Briefing> {
  const generatedAt = new Date().toISOString();
  const text = await callClaude({
    system: SYSTEM,
    user: `Today's analysis data:\n${JSON.stringify(input, null, 2)}`,
    effort: "medium",
    maxTokens: 8000,
  });
  if (text) return { text: text.trim(), engine: "ai", model: `Claude (${CLAUDE_MODEL})`, generatedAt };
  return { text: templateBriefing(input), engine: "template", model: null, generatedAt };
}

const fmt = (n: number) => (n > 0 ? `+${n.toFixed(0)}` : n.toFixed(0));

/** Deterministic fallback when no AI model is available, built only from the input figures. */
function templateBriefing(d: BriefingInput): string {
  const parts: string[] = [];
  parts.push(
    `${d.totalRecords} community records were analysed for ${d.date}, with an overall sentiment of ${fmt(d.avgSentiment)} and average engagement index of ${d.avgEngagement.toFixed(0)}.`
  );
  const ranked = [...d.games].sort((a, b) => b.records - a.records);
  if (ranked.length) {
    const top = ranked[0];
    parts.push(`${top.name} drew the most discussion (${top.records} records, sentiment ${fmt(top.avgSentiment)}).`);
    const worst = [...d.games].sort((a, b) => a.avgSentiment - b.avgSentiment)[0];
    if (worst && worst.name !== top.name) {
      parts.push(`${worst.name} had the weakest sentiment at ${fmt(worst.avgSentiment)}.`);
    }
  }
  const leadTheme = d.themes.find((t) => t.theme !== "other");
  if (leadTheme) {
    parts.push(`The leading theme was ${leadTheme.theme} (${leadTheme.count} mentions).`);
  }
  if (d.riskCount > 0) {
    const risky = d.riskyThemes.length ? ` Themes trending negative: ${d.riskyThemes.join(", ")}.` : "";
    parts.push(`${d.riskCount} potential community risks were flagged.${risky}`);
  }
  if (d.spikes.length) parts.push(`A volume spike was detected on ${d.spikes[d.spikes.length - 1].date}.`);
  if (d.previous) {
    const delta = d.avgSentiment - d.previous.avgSentiment;
    parts.push(`Compared with ${d.previous.date}, overall sentiment moved ${fmt(delta)} points.`);
  }
  if (d.samplePercent > 0) {
    parts.push(`${d.samplePercent}% of today's data is illustrative sample data.`);
  }
  parts.push("(Automated summary: the AI briefing engine is not configured.)");
  return parts.join(" ");
}

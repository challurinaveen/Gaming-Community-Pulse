import { NextResponse } from "next/server";
import { THEMES } from "@/lib/analysis/sentiment";
import { ENGAGEMENT_CEILINGS } from "@/lib/analysis/engagement";
import { activeLLM } from "@/lib/ai/llm";
import { GEMINI_MODEL } from "@/lib/ai/clustering";
import { RETENTION_DAYS, REDDIT_RETENTION_DAYS } from "@/lib/dashboard/build";

export async function GET() {
  const llm = activeLLM()?.label ?? "No AI model configured";
  return NextResponse.json({
    pipeline: ["collect", "enrich", "aggregate", "compare", "brief", "serve"],
    collection: {
      youtube: "Latest 8 uploads per configured channel; up to 25 top-level comments per video in two orderings (relevance, newest).",
      reddit: "Top 50 posts of the trailing week and the 100 most recent comments per subreddit.",
      discord: "100 most recent messages per channel the bot can read, with reaction counts; reply counts are counted within that window.",
      twitch: "20 most-viewed clips of the trailing 30 days per category, plus a live-viewer snapshot of the top 20 live streams (not scored as discussion).",
      sampleData:
        "Any platform returning no live records is filled with clearly labelled illustrative sample rows. Samples are scored only by the deterministic lexicon, never sent to an AI model, and never stored.",
    },
    sentiment: {
      scale: "-100 (very negative) to +100 (very positive)",
      buckets: { positive: "> 20", neutral: "-20 to 20", negative: "< -20" },
      primaryEngine: `${llm}, zero-shot with gaming vocabulary guidance and worked sarcasm examples; structured JSON output, batches of 20. Claude is used whenever ANTHROPIC_API_KEY is set; OpenAI is a stand-in otherwise.`,
      fallbackEngine: "Hand-built lexicon with negation, intensifiers and gaming slang; cannot detect sarcasm.",
      perRecordFields: ["score", "confidence", "sarcasm", "theme", "isQuestion", "isRisk", "engine"],
      themes: THEMES,
      inputTruncation: "Text is truncated to 1,500 characters before scoring.",
    },
    engagementIndex: {
      formula: "min(100, ln(1 + weightedSignal) / ln(1 + ceiling) * 100)",
      weightedSignal: {
        youtube: "likes + 3 * replies",
        reddit: "upvotes + 5 * comments",
        discord: "reactions + 2 * replies",
        twitch: "clip views",
      },
      ceilings: ENGAGEMENT_CEILINGS,
      caveat: "Ceilings are estimated orders of magnitude, not calibrated against campaign history.",
    },
    region: {
      basis: "Publisher-side signals only; never the commenter's location.",
      precedence: [
        { signal: "YouTube channel declared country", confidence: 0.95 },
        { signal: "Manually configured region for a known source", confidence: 0.9 },
        { signal: "Discord server preferred locale", confidence: 0.8 },
        { signal: "Content declared language", confidence: 0.7 },
        { signal: "Detected text language", confidence: 0.4 },
      ],
      fallback: "Undetermined (confidence 0)",
    },
    patterns: {
      volumeSpikes:
        "Per game, the count of records published in the 24h before collection is stored daily. A day is a spike when it exceeds the trailing mean + 2 standard deviations of up to 7 prior days (or double the mean when the baseline is flat). Requires at least 3 prior days.",
      risks: "Count of records flagged as risk (churn, boycott, refund, toxicity, legal), plus themes with at least 3 posts whose average sentiment is below -30.",
      recurringQuestions: "Question records grouped greedily by Jaccard similarity (> 0.3) of their stopword-filtered vocabulary.",
    },
    ai: {
      briefing: `${llm} writes a 150-200 word summary from the aggregated figures only; told not to claim changes when no prior snapshot exists. Template summary when unavailable.`,
      discussionClustering: `Gemini (${GEMINI_MODEL}) groups each game's live records into 3-5 sub-topics by returning record indices only. Displayed quotes and links are read back from collected data; indices not in the list are discarded.`,
    },
    storage: {
      tables: ["daily_snapshots (upsert on date)", "community_records (upsert on platform + source_id)", "app_users (RLS, service key only)"],
      retentionDays: RETENTION_DAYS,
      redditContentRetention: `Reddit records are deleted automatically ${REDDIT_RETENTION_DAYS} days after they were first collected (checked on every refresh).`,
    },
  });
}

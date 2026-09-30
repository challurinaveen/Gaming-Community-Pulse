// ---------------------------------------------------------------------------
// Sentiment analysis – semantic (LLM: Claude, or OpenAI as stand-in) + lexicon fallback
// ---------------------------------------------------------------------------

import { activeLLM, callLLM } from "@/lib/ai/llm";

export interface SentimentResult {
  id: string;
  score: number; // -100 to +100
  confidence: number; // 0 to 1
  sarcasm: boolean;
  theme: string;
  isQuestion: boolean;
  isRisk: boolean;
  engine: "semantic" | "lexicon";
}

export const THEMES = [
  "gameplay",
  "performance",
  "monetization",
  "community",
  "update",
  "balance",
  "bugs",
  "content",
  "graphics",
  "story",
  "competitive",
  "casual",
  "events",
  "support",
  "streaming",
  "modding",
  "other",
] as const;

export type Theme = (typeof THEMES)[number];

// ---------------------------------------------------------------------------
// Semantic engine (Claude)
// ---------------------------------------------------------------------------

const SENTIMENT_SYSTEM_PROMPT = `You are a gaming community sentiment analyst. Analyze each text and return structured JSON.

Gaming-specific vocabulary guidance:
- Strong positive: "insane", "cracked", "goated" are praise in gaming contexts. "Insane" means impressively good. "Cracked" means extremely skilled. "Goated" means greatest of all time.
- Strong negative: "dead game" means the game is losing players and relevance. "Cash grab" means exploitative monetization. "P2W" (pay-to-win) means real money buys competitive advantage.
- Context-dependent: "copium" means coping with bad news through denial or false hope (mildly negative). "Hopium" means unrealistic optimism about future improvements (mildly negative to neutral).

Sarcasm detection — worked examples:
- "oh great, another battle pass" = NEGATIVE sarcasm. The user is mocking the addition of yet another battle pass.
- "wow what a surprise, servers down again" = NEGATIVE sarcasm. Feigned surprise about a recurring problem.
- "totally balanced, not broken at all" = NEGATIVE sarcasm. Sarcastically praising something the user considers overpowered or broken.

For each input text, produce an object with:
- id: the id from the input
- score: integer from -100 (extremely negative) to +100 (extremely positive)
- confidence: float from 0.0 to 1.0 indicating how confident you are
- sarcasm: boolean, true if the text uses sarcasm or irony
- theme: one of the allowed theme values
- isQuestion: boolean, true if the text is primarily asking a question
- isRisk: boolean, true if the text signals churn risk, boycott intent, refund demand, toxicity complaints, or legal threats`;

/** JSON Schema for structured output (top-level must be object). */
const SENTIMENT_SCHEMA = {
  type: "object" as const,
  properties: {
    results: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          score: { type: "integer" as const },
          confidence: { type: "number" as const },
          sarcasm: { type: "boolean" as const },
          theme: {
            type: "string" as const,
            enum: [...THEMES],
          },
          isQuestion: { type: "boolean" as const },
          isRisk: { type: "boolean" as const },
        },
        required: [
          "id",
          "score",
          "confidence",
          "sarcasm",
          "theme",
          "isQuestion",
          "isRisk",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

const BATCH_SIZE = 20;
const CONCURRENCY = 6;

async function callClaudeForSentiment(
  texts: { id: string; content: string }[]
): Promise<SentimentResult[] | null> {
  const userContent = texts
    .map((t) => `[id=${t.id}]: ${t.content}`)
    .join("\n\n");

  const text = await callLLM({
    system: SENTIMENT_SYSTEM_PROMPT,
    user: `Analyze these ${texts.length} texts:\n\n${userContent}`,
    schema: SENTIMENT_SCHEMA,
    effort: "low",
  });

  if (!text) return null;

  try {
    const parsed: {
      results: {
        id: string;
        score: number;
        confidence: number;
        sarcasm: boolean;
        theme: string;
        isQuestion: boolean;
        isRisk: boolean;
      }[];
    } = JSON.parse(text);

    if (!Array.isArray(parsed.results)) return null;

    return parsed.results.map((r) => ({
      id: r.id,
      score: clampScore(r.score),
      confidence: clampConfidence(r.confidence),
      sarcasm: Boolean(r.sarcasm),
      theme: validateTheme(r.theme),
      isQuestion: Boolean(r.isQuestion),
      isRisk: Boolean(r.isRisk),
      engine: "semantic" as const,
    }));
  } catch {
    return null;
  }
}

export async function analyzeSentimentSemantic(
  texts: { id: string; content: string }[]
): Promise<SentimentResult[]> {
  const batches: { id: string; content: string }[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) batches.push(texts.slice(i, i + BATCH_SIZE));

  const results: SentimentResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      const wanted = new Set(batch.map((t) => t.id));
      const scored = (await callClaudeForSentiment(batch))?.filter((r) => wanted.has(r.id)) ?? [];
      const returned = new Set(scored.map((r) => r.id));
      results.push(...scored);
      // Any record the model skipped (or a whole failed batch) gets the lexicon result.
      for (const t of batch) {
        if (!returned.has(t.id)) results.push({ ...analyzeSentimentLexicon(t.content), id: t.id });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Lexicon fallback
// ---------------------------------------------------------------------------

interface ScoredPhrase {
  phrase: string;
  score: number;
}

const STRONG_POSITIVE: ScoredPhrase[] = [
  { phrase: "best ever", score: 80 },
  { phrase: "love it", score: 80 },
  { phrase: "10/10", score: 80 },
  { phrase: "amazing", score: 80 },
  { phrase: "incredible", score: 80 },
  { phrase: "goated", score: 80 },
  { phrase: "cracked", score: 80 },
  { phrase: "masterpiece", score: 80 },
  { phrase: "insane", score: 80 },
];

const MILD_POSITIVE: ScoredPhrase[] = [
  { phrase: "not bad", score: 30 },
  { phrase: "good", score: 30 },
  { phrase: "nice", score: 30 },
  { phrase: "fun", score: 30 },
  { phrase: "decent", score: 30 },
  { phrase: "solid", score: 30 },
];

const MILD_NEGATIVE: ScoredPhrase[] = [
  { phrase: "meh", score: -30 },
  { phrase: "boring", score: -30 },
  { phrase: "mid", score: -30 },
  { phrase: "disappointing", score: -30 },
  { phrase: "underwhelming", score: -30 },
];

const STRONG_NEGATIVE: ScoredPhrase[] = [
  { phrase: "dead game", score: -80 },
  { phrase: "cash grab", score: -80 },
  { phrase: "trash", score: -80 },
  { phrase: "garbage", score: -80 },
  { phrase: "uninstalling", score: -80 },
  { phrase: "p2w", score: -80 },
  { phrase: "broken", score: -80 },
  { phrase: "worst", score: -80 },
  { phrase: "scam", score: -80 },
  { phrase: "refund", score: -80 },
];

const ALL_PHRASES: ScoredPhrase[] = [
  ...STRONG_POSITIVE,
  ...MILD_POSITIVE,
  ...MILD_NEGATIVE,
  ...STRONG_NEGATIVE,
];

const NEGATION_WORDS = new Set([
  "not",
  "no",
  "never",
  "don't",
  "doesn't",
  "isn't",
  "won't",
  "dont",
  "doesnt",
  "isnt",
  "wont",
]);

const INTENSIFIERS = new Set([
  "very",
  "really",
  "absolutely",
  "totally",
  "super",
]);

const QUESTION_STARTERS = new Set([
  "who",
  "what",
  "where",
  "when",
  "why",
  "how",
  "is",
  "are",
  "can",
  "could",
  "will",
  "would",
  "should",
  "do",
  "does",
  "did",
  "has",
  "have",
]);

const RISK_WORDS = new Set([
  "quit",
  "boycott",
  "refund",
  "lawsuit",
  "toxic",
  "quitting",
  "uninstall",
  "uninstalling",
]);

// Theme keyword map for lexicon detection
const THEME_KEYWORDS: Record<Theme, string[]> = {
  gameplay: ["gameplay", "mechanics", "controls", "combat", "movement"],
  performance: [
    "fps",
    "lag",
    "latency",
    "frame",
    "framerate",
    "stutter",
    "crash",
    "optimization",
  ],
  monetization: [
    "price",
    "pay",
    "p2w",
    "microtransaction",
    "loot box",
    "battle pass",
    "dlc",
    "cash grab",
    "skin",
    "cosmetic",
  ],
  community: [
    "community",
    "player",
    "playerbase",
    "toxic",
    "wholesome",
    "friendly",
  ],
  update: [
    "update",
    "patch",
    "hotfix",
    "changelog",
    "new version",
    "maintenance",
  ],
  balance: [
    "balance",
    "nerf",
    "buff",
    "overpowered",
    "underpowered",
    "op",
    "meta",
  ],
  bugs: ["bug", "glitch", "exploit", "broken", "fix", "issue"],
  content: [
    "content",
    "map",
    "level",
    "mission",
    "quest",
    "mode",
    "character",
    "hero",
    "champion",
  ],
  graphics: [
    "graphics",
    "visual",
    "render",
    "texture",
    "shader",
    "resolution",
    "ray tracing",
  ],
  story: [
    "story",
    "lore",
    "narrative",
    "plot",
    "cutscene",
    "dialogue",
    "campaign",
  ],
  competitive: [
    "ranked",
    "competitive",
    "esports",
    "tournament",
    "elo",
    "mmr",
    "leaderboard",
  ],
  casual: ["casual", "chill", "relax", "cozy", "singleplayer", "single player"],
  events: ["event", "season", "limited time", "holiday", "celebration"],
  support: [
    "support",
    "ticket",
    "customer service",
    "devs",
    "developer",
    "response",
  ],
  streaming: [
    "stream",
    "streamer",
    "twitch",
    "youtube",
    "content creator",
    "viewer",
  ],
  modding: ["mod", "modding", "workshop", "custom", "addon", "plugin"],
  other: [],
};

function detectThemeLexicon(lower: string): Theme {
  let bestTheme: Theme = "other";
  let bestCount = 0;

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (theme === "other") continue;
    let count = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestTheme = theme as Theme;
    }
  }

  return bestTheme;
}

export function analyzeSentimentLexicon(content: string): SentimentResult {
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/);

  // --- Score calculation ---
  let totalScore = 0;
  let matchCount = 0;

  // Check multi-word phrases first
  for (const { phrase, score } of ALL_PHRASES) {
    if (phrase.includes(" ")) {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        // Check for negation in the 3 words preceding the phrase
        const before = lower.slice(Math.max(0, idx - 30), idx).trim();
        const beforeWords = before.split(/\s+/);
        const lastFew = beforeWords.slice(-3);
        const negated = lastFew.some((w) => NEGATION_WORDS.has(w));
        const intensified = lastFew.some((w) => INTENSIFIERS.has(w));

        let adjusted = negated ? -score : score;
        if (intensified) adjusted = Math.round(adjusted * 1.5);

        totalScore += adjusted;
        matchCount++;
      }
    }
  }

  // Check single words
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z0-9/]/g, "");
    if (!word) continue;

    const match = ALL_PHRASES.find(
      (p) => !p.phrase.includes(" ") && p.phrase === word
    );
    if (!match) continue;

    // Check for negation in prior 3 words
    const negated = words
      .slice(Math.max(0, i - 3), i)
      .some((w) => NEGATION_WORDS.has(w.replace(/[^a-z']/g, "")));
    const intensified = words
      .slice(Math.max(0, i - 2), i)
      .some((w) => INTENSIFIERS.has(w.replace(/[^a-z]/g, "")));

    let adjusted = negated ? -match.score : match.score;
    if (intensified) adjusted = Math.round(adjusted * 1.5);

    totalScore += adjusted;
    matchCount++;
  }

  // Average the matched scores, default to 0 if no matches
  const score =
    matchCount > 0 ? clampScore(Math.round(totalScore / matchCount)) : 0;

  // Confidence is low for lexicon – more matches = slightly more confident
  const confidence =
    matchCount > 0 ? Math.min(0.6, 0.3 + matchCount * 0.1) : 0.1;

  // --- Question detection ---
  const isQuestion =
    content.trim().endsWith("?") ||
    QUESTION_STARTERS.has(words[0]?.replace(/[^a-z]/g, "") ?? "");

  // --- Risk detection ---
  const isRisk = words.some((w) => RISK_WORDS.has(w.replace(/[^a-z]/g, "")));

  // --- Theme detection ---
  const theme = detectThemeLexicon(lower);

  return {
    id: "", // Caller must set this
    score,
    confidence,
    sarcasm: false, // Lexicon cannot detect sarcasm
    theme,
    isQuestion,
    isRisk,
    engine: "lexicon",
  };
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

export async function analyzeSentiment(
  records: { id: string; content: string }[]
): Promise<SentimentResult[]> {
  if (records.length === 0) return [];

  if (activeLLM()) {
    return analyzeSentimentSemantic(records);
  }

  // Lexicon fallback for every record
  return records.map((r) => {
    const result = analyzeSentimentLexicon(r.content);
    result.id = r.id;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampScore(score: number): number {
  return Math.max(-100, Math.min(100, Math.round(score)));
}

function clampConfidence(conf: number): number {
  return Math.max(0, Math.min(1, Number(conf.toFixed(2))));
}

function validateTheme(theme: string): Theme {
  const lower = theme?.toLowerCase() as Theme;
  if (THEMES.includes(lower)) return lower;
  return "other";
}

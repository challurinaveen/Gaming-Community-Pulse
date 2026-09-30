import Anthropic from "@anthropic-ai/sdk";

// Sonnet 5 rather than Opus: ~100 scoring batches per first refresh made Opus too costly to run daily.
export const CLAUDE_MODEL = "claude-sonnet-5";

/** Set when Claude rejects calls for a reason retrying won't fix (no credit, bad key); shown on the dashboard. */
let issue: { message: string; at: number } | null = null;
let blockedUntil = 0;
const BLOCK_MS = 10 * 60 * 1000;

export function getClaudeIssue(): string | null {
  return issue && Date.now() - issue.at < BLOCK_MS ? issue.message : null;
}

function block(message: string) {
  issue = { message, at: Date.now() };
  blockedUntil = Date.now() + BLOCK_MS;
}

export interface ClaudeCallOptions {
  system: string;
  user: string;
  /** JSON Schema for structured output (every object: additionalProperties false, all properties required). */
  schema?: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

let client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic | null {
  if (!isClaudeConfigured()) return null;
  client ??= new Anthropic();
  return client;
}

/**
 * Single Claude call. Returns the response text, or null when Claude isn't configured, the request
 * fails, or the model refuses; callers then fall back to deterministic logic.
 */
export async function callClaude({
  system,
  user,
  schema,
  effort = "low",
  maxTokens = 16000,
}: ClaudeCallOptions): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  if (blockedUntil > Date.now()) return null;

  try {
    const response = await anthropic.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        effort,
        ...(schema ? { format: { type: "json_schema" as const, schema } } : {}),
      },
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn(`[claude] unusable response: stop_reason=${response.stop_reason}`);
      return null;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    issue = null;
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
      console.error("[claude] credit balance too low; pausing Claude calls for 10 minutes");
      block("Anthropic credit balance is too low. Add credit at console.anthropic.com (Plans & Billing).");
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("[claude] invalid ANTHROPIC_API_KEY");
      block("ANTHROPIC_API_KEY was rejected. Check the key in your settings.");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.warn("[claude] rate limited");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[claude] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[claude] request failed", error);
    }
    return null;
  }
}

import Anthropic from "@anthropic-ai/sdk";
import type { LLMCallOptions } from "@/lib/ai/types";

export const CLAUDE_MODEL = "claude-opus-5";

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
 * Single Claude call. Returns the response text, or null when Claude isn't configured,
 * the request fails, or the whole fallback chain refuses — callers fall back to deterministic logic.
 */
export async function callClaude({
  system,
  user,
  schema,
  effort = "low",
  maxTokens = 16000,
}: LLMCallOptions): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
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
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("[claude] rate limited");
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("[claude] invalid ANTHROPIC_API_KEY");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[claude] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[claude] request failed", error);
    }
    return null;
  }
}

import OpenAI from "openai";
import type { LLMCallOptions } from "@/lib/ai/types";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Returns the response text, or null when OpenAI isn't configured, the request fails, or the output is incomplete/refused. */
export async function callOpenAI({ system, user, schema, effort = "low", maxTokens = 16000 }: LLMCallOptions): Promise<string | null> {
  if (!isOpenAIConfigured()) return null;
  client ??= new OpenAI();

  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: system,
      input: user,
      max_output_tokens: maxTokens,
      reasoning: { effort },
      ...(schema ? { text: { format: { type: "json_schema" as const, name: "result", schema, strict: true } } } : {}),
    });

    if (response.status === "incomplete") {
      console.warn(`[openai] incomplete response: ${response.incomplete_details?.reason ?? "unknown"}`);
      return null;
    }
    return response.output_text || null;
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      console.warn("[openai] rate limited or out of credit");
    } else if (error instanceof OpenAI.AuthenticationError) {
      console.error("[openai] invalid OPENAI_API_KEY");
    } else if (error instanceof OpenAI.APIError) {
      console.error(`[openai] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[openai] request failed", error);
    }
    return null;
  }
}

import { callClaude, isClaudeConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { callOpenAI, isOpenAIConfigured, OPENAI_MODEL } from "@/lib/ai/openai";
import type { LLMCallOptions } from "@/lib/ai/types";

export type { LLMCallOptions };
export type LLMProvider = "claude" | "openai";

/** Claude is the documented engine and wins when its key is present; OpenAI is the stand-in otherwise. */
export function activeLLM(): { provider: LLMProvider; label: string } | null {
  if (isClaudeConfigured()) return { provider: "claude", label: `Claude (${CLAUDE_MODEL})` };
  if (isOpenAIConfigured()) return { provider: "openai", label: `OpenAI (${OPENAI_MODEL})` };
  return null;
}

export async function callLLM(options: LLMCallOptions): Promise<string | null> {
  const llm = activeLLM();
  if (!llm) return null;
  return llm.provider === "claude" ? callClaude(options) : callOpenAI(options);
}

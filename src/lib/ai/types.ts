export interface LLMCallOptions {
  system: string;
  user: string;
  /** JSON Schema for structured output (every object: additionalProperties false, all properties required). */
  schema?: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

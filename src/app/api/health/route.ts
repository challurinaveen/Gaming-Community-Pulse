import { NextResponse } from "next/server";
import { getStorageStatus } from "@/lib/dashboard/build";
import { isClaudeConfigured } from "@/lib/ai/claude";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { activeLLM } from "@/lib/ai/llm";
import { enabledPlatforms, PLATFORMS } from "@/lib/platforms";
import { isGeminiConfigured } from "@/lib/ai/clustering";
import { isSessionConfigured } from "@/lib/auth/token";

/** Public: reports only whether each integration is configured, never any values. */
export async function GET() {
  const env = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]));
  const { last_write: { error: _hidden, ...lastWrite }, ...storage } = getStorageStatus();
  return NextResponse.json(
    {
      status: "ok",
      time: new Date().toISOString(),
      auth: { sessionSecret: isSessionConfigured() },
      storage: { ...storage, last_write: lastWrite },
      ai: {
        claude: isClaudeConfigured(),
        openai: isOpenAIConfigured(),
        activeTextModel: activeLLM()?.provider ?? null,
        gemini: isGeminiConfigured(),
      },
      platforms: {
        youtube: env("YOUTUBE_API_KEY"),
        reddit: env("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"),
        discord: env("DISCORD_BOT_TOKEN"),
        twitch: env("TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"),
      },
      disabledPlatforms: PLATFORMS.filter((p) => !enabledPlatforms().includes(p)),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { NextResponse } from "next/server";
import { getStorageStatus } from "@/lib/dashboard/build";
import { isClaudeConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { isGeminiConfigured, GEMINI_MODEL } from "@/lib/ai/clustering";
import { isSessionConfigured } from "@/lib/auth/token";
import { enabledPlatforms, PLATFORMS } from "@/lib/platforms";

/** Deployment/configuration status (report Appendix B, Table 8). Signed-in only; reports true/false, never values. */
export async function GET() {
  const env = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]));
  return NextResponse.json(
    {
      status: "ok",
      time: new Date().toISOString(),
      auth: { sessionSigning: isSessionConfigured() },
      storage: getStorageStatus(),
      ai: {
        claude: isClaudeConfigured(),
        claudeModel: CLAUDE_MODEL,
        gemini: isGeminiConfigured(),
        geminiModel: GEMINI_MODEL,
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

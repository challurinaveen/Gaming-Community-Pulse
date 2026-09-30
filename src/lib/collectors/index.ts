import { GAMES } from "@/lib/config/games";
import { enabledPlatforms } from "@/lib/platforms";
import type { RawRecord, PlatformStatus } from "@/lib/collectors/types";
import { collectYouTube } from "@/lib/collectors/youtube";
import { collectReddit } from "@/lib/collectors/reddit";
import { collectDiscord } from "@/lib/collectors/discord";
import { collectTwitch } from "@/lib/collectors/twitch";

export type { RawRecord, PlatformStatus } from "@/lib/collectors/types";

// ---------------------------------------------------------------------------
// Orchestrate all collectors
// ---------------------------------------------------------------------------

/**
 * Run all four platform collectors in parallel across every configured game.
 * Never throws — individual platform failures are caught and surfaced in
 * the returned `platforms` status array.
 */
export async function collectAll(): Promise<{
  records: RawRecord[];
  platforms: PlatformStatus[];
}> {
  // Build one promise per platform (each iterates all games internally)
  const youtubePromise = runCollector("youtube", collectYouTube);
  const redditPromise = runCollector("reddit", collectReddit);
  const discordPromise = runCollector("discord", collectDiscord);
  const twitchPromise = runCollector("twitch", collectTwitch);

  const results = await Promise.allSettled([
    youtubePromise,
    redditPromise,
    discordPromise,
    twitchPromise,
  ]);

  const platformNames: Array<RawRecord["platform"]> = [
    "youtube",
    "reddit",
    "discord",
    "twitch",
  ];

  const records: RawRecord[] = [];
  const platforms: PlatformStatus[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const platform = platformNames[i];

    if (result.status === "fulfilled") {
      records.push(...result.value.records);
      platforms.push({
        platform,
        configured: result.value.configured,
        recordCount: result.value.records.length,
        error: undefined,
      });
    } else {
      platforms.push({
        platform,
        configured: false,
        recordCount: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  return { records, platforms };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

interface CollectorResult {
  configured: boolean;
  records: RawRecord[];
}

type CollectorFn = (
  game: (typeof GAMES)[number]
) => Promise<RawRecord[]>;

/**
 * Run a single collector across all games, catching per-game errors so one
 * game cannot bring down the whole platform run.
 */
async function runCollector(
  platform: RawRecord["platform"],
  collector: CollectorFn
): Promise<CollectorResult> {
  const configured = isConfigured(platform);

  if (!configured || !enabledPlatforms().includes(platform)) {
    return { configured: false, records: [] };
  }

  // Games are collected in parallel; results keep GAMES order.
  const perGame = await Promise.all(
    GAMES.map((game) =>
      collector(game).catch((err) => {
        console.error(`[${platform}] failed for game ${game.id}:`, err);
        return [] as RawRecord[];
      })
    )
  );

  return { configured: true, records: perGame.flat() };
}

/**
 * Check whether the required env vars for a platform are set.
 */
function isConfigured(platform: RawRecord["platform"]): boolean {
  switch (platform) {
    case "youtube":
      return !!process.env.YOUTUBE_API_KEY;
    case "reddit":
      return (
        !!process.env.REDDIT_CLIENT_ID &&
        !!process.env.REDDIT_CLIENT_SECRET
      );
    case "discord":
      return !!process.env.DISCORD_BOT_TOKEN;
    case "twitch":
      return (
        !!process.env.TWITCH_CLIENT_ID &&
        !!process.env.TWITCH_CLIENT_SECRET
      );
    default:
      return false;
  }
}

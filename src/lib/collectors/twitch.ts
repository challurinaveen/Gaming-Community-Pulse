import type { GameConfig } from "@/lib/config/games";
import type { RawRecord } from "@/lib/collectors/types";

// ---------------------------------------------------------------------------
// Twitch Helix API collector
// ---------------------------------------------------------------------------

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_BASE = "https://api.twitch.tv/helix";

/**
 * Obtain an app-access OAuth token from Twitch.
 */
async function getTwitchToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    const res = await fetch(`${TOKEN_URL}?${params.toString()}`, {
      method: "POST",
    });

    if (!res.ok) {
      console.error(`[twitch] OAuth token request failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error("[twitch] OAuth token error:", err);
    return null;
  }
}

interface TwitchGame {
  id: string;
  name: string;
}

interface TwitchClip {
  id: string;
  title: string;
  creator_name: string;
  created_at: string;
  view_count: number;
  game_id: string;
  language: string;
  url: string;
}

interface TwitchStream {
  id: string;
  user_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  game_id: string;
}

/**
 * Collect top clips and live streams from Twitch for a game.
 * Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET. Returns [] if missing.
 */
export async function collectTwitch(
  game: GameConfig
): Promise<RawRecord[]> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const token = await getTwitchToken(clientId, clientSecret);
  if (!token) return [];

  const headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": clientId,
  };

  const records: RawRecord[] = [];

  try {
    // --- Resolve category name to game ID --------------------------------
    let gameId = game.twitch.categoryId;

    if (!gameId) {
      const gamesRes = await fetch(
        `${API_BASE}/games?name=${encodeURIComponent(game.twitch.categoryName)}`,
        { headers }
      );

      if (!gamesRes.ok) {
        console.error(
          `[twitch] game lookup failed for "${game.twitch.categoryName}": ${gamesRes.status}`
        );
        return records;
      }

      const gamesData = (await gamesRes.json()) as {
        data?: TwitchGame[];
      };
      gameId = gamesData.data?.[0]?.id;

      if (!gameId) {
        console.error(
          `[twitch] no game found for "${game.twitch.categoryName}"`
        );
        return records;
      }
    }

    // --- Fetch top clips (trailing 30 days) ------------------------------
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const clipsUrl = new URL(`${API_BASE}/clips`);
    clipsUrl.searchParams.set("game_id", gameId);
    clipsUrl.searchParams.set("first", "20");
    clipsUrl.searchParams.set("started_at", thirtyDaysAgo.toISOString());
    clipsUrl.searchParams.set("ended_at", new Date().toISOString());

    const clipsRes = await fetch(clipsUrl.toString(), { headers });

    if (clipsRes.ok) {
      const clipsData = (await clipsRes.json()) as {
        data?: TwitchClip[];
      };

      for (const clip of clipsData.data ?? []) {
        records.push({
          platform: "twitch",
          sourceId: `twitch-clip-${clip.id}`,
          game: game.id,
          author: clip.creator_name,
          content: clip.title,
          publishedAt: new Date(clip.created_at),
          rawData: {
            type: "clip",
            view_count: clip.view_count,
            language: clip.language,
            url: clip.url,
          },
          isSample: false,
        });
      }
    } else {
      console.error(
        `[twitch] clips fetch failed for game ${gameId}: ${clipsRes.status}`
      );
    }

    // --- Fetch live streams ----------------------------------------------
    const streamsUrl = new URL(`${API_BASE}/streams`);
    streamsUrl.searchParams.set("game_id", gameId);
    streamsUrl.searchParams.set("first", "20");

    const streamsRes = await fetch(streamsUrl.toString(), { headers });

    if (streamsRes.ok) {
      const streamsData = (await streamsRes.json()) as {
        data?: TwitchStream[];
      };

      for (const stream of streamsData.data ?? []) {
        records.push({
          platform: "twitch",
          sourceId: `twitch-stream-${stream.id}`,
          game: game.id,
          author: stream.user_name,
          content: stream.title,
          publishedAt: new Date(stream.started_at),
          rawData: {
            type: "stream",
            view_count: stream.viewer_count,
          },
          isSample: false,
        });
      }
    } else {
      console.error(
        `[twitch] streams fetch failed for game ${gameId}: ${streamsRes.status}`
      );
    }
  } catch (err) {
    console.error(
      `[twitch] collection failed for "${game.twitch.categoryName}":`,
      err
    );
  }

  return records;
}

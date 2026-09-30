import type { GameConfig } from "@/lib/config/games";
import type { RawRecord } from "@/lib/collectors/types";

// ---------------------------------------------------------------------------
// Reddit OAuth API collector
// ---------------------------------------------------------------------------

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";
// Reddit rate-limits generic user agents; its required format is platform:app-id:version (by /u/username).
const USER_AGENT = `web:gaming-community-pulse:v1.0${process.env.REDDIT_USERNAME ? ` (by /u/${process.env.REDDIT_USERNAME})` : ""}`;

/**
 * Obtain an app-only OAuth token using client credentials.
 */
async function getRedditToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      console.error(`[reddit] OAuth token request failed: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error("[reddit] OAuth token error:", err);
    return null;
  }
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    ups: number;
    num_comments: number;
    score: number;
    permalink: string;
  };
}

interface RedditComment {
  data: {
    id: string;
    body: string;
    author: string;
    created_utc: number;
    ups: number;
    score: number;
    permalink: string;
  };
}

/**
 * Collect top posts and recent comments from Reddit for a game.
 * Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. Returns [] if missing.
 */
export async function collectReddit(
  game: GameConfig
): Promise<RawRecord[]> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const token = await getRedditToken(clientId, clientSecret);
  if (!token) return [];

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": USER_AGENT,
  };

  const records: RawRecord[] = [];

  for (const subreddit of game.reddit.subreddits) {
    try {
      // --- Top posts (trailing week) ------------------------------------
      const postsRes = await fetch(
        `${API_BASE}/r/${subreddit}/top?t=week&limit=50`,
        { headers }
      );

      if (!postsRes.ok) {
        console.error(
          `[reddit] posts fetch failed for r/${subreddit}: ${postsRes.status}`
        );
        continue;
      }

      const postsData = (await postsRes.json()) as {
        data?: { children?: RedditPost[] };
      };

      for (const post of postsData.data?.children ?? []) {
        const d = post.data;
        records.push({
          platform: "reddit",
          sourceId: `reddit-post-${d.id}`,
          game: game.id,
          author: d.author,
          content: d.selftext
            ? `${d.title}\n\n${d.selftext}`
            : d.title,
          publishedAt: new Date(d.created_utc * 1000),
          rawData: {
            type: "post",
            ups: d.ups,
            num_comments: d.num_comments,
            score: d.score,
            subreddit,
            url: `https://www.reddit.com${d.permalink}`,
          },
          isSample: false,
        });
      }

      // --- Recent comments -----------------------------------------------
      const commentsRes = await fetch(
        `${API_BASE}/r/${subreddit}/comments?limit=100`,
        { headers }
      );

      if (!commentsRes.ok) {
        console.error(
          `[reddit] comments fetch failed for r/${subreddit}: ${commentsRes.status}`
        );
        continue;
      }

      const commentsData = (await commentsRes.json()) as {
        data?: { children?: RedditComment[] };
      };

      for (const comment of commentsData.data?.children ?? []) {
        const d = comment.data;
        if (!d.body || d.author === "AutoModerator") continue;
        records.push({
          platform: "reddit",
          sourceId: `reddit-comment-${d.id}`,
          game: game.id,
          author: d.author,
          content: d.body,
          publishedAt: new Date(d.created_utc * 1000),
          rawData: {
            type: "comment",
            ups: d.ups,
            score: d.score,
            subreddit,
            url: `https://www.reddit.com${d.permalink}`,
          },
          isSample: false,
        });
      }
    } catch (err) {
      console.error(
        `[reddit] r/${subreddit} collection failed:`,
        err
      );
    }
  }

  return records;
}

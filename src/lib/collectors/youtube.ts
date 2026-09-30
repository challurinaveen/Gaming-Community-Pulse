import type { GameConfig } from "@/lib/config/games";
import type { RawRecord } from "@/lib/collectors/types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const UPLOADS_PER_CHANNEL = 8;
const COMMENTS_PER_ORDERING = 25;
const ORDERINGS = ["relevance", "time"] as const;

interface YTChannel {
  snippet: { title: string; country?: string; defaultLanguage?: string };
  contentDetails: { relatedPlaylists: { uploads: string } };
}

interface YTPlaylistItem {
  snippet: { title: string; resourceId: { videoId: string } };
}

interface YTCommentThread {
  snippet: {
    totalReplyCount: number;
    topLevelComment: {
      id: string;
      snippet: { authorDisplayName: string; textOriginal: string; likeCount: number; publishedAt: string };
    };
  };
}

async function yt<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T | null> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[youtube] ${path} failed: ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

/**
 * Latest uploads per configured channel, then top-level comments in two orderings (relevance + newest).
 * Uses channels/playlistItems (1 quota unit each) rather than search (100 units).
 */
export async function collectYouTube(game: GameConfig): Promise<RawRecord[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const records = new Map<string, RawRecord>();

  for (const channelId of game.youtube.channelIds) {
    try {
      const channels = await yt<{ items?: YTChannel[] }>("channels", { part: "snippet,contentDetails", id: channelId }, apiKey);
      const channel = channels?.items?.[0];
      if (!channel) continue;

      const uploads = await yt<{ items?: YTPlaylistItem[] }>(
        "playlistItems",
        { part: "snippet", playlistId: channel.contentDetails.relatedPlaylists.uploads, maxResults: String(UPLOADS_PER_CHANNEL) },
        apiKey
      );

      for (const upload of uploads?.items ?? []) {
        const videoId = upload.snippet.resourceId.videoId;
        for (const order of ORDERINGS) {
          const threads = await yt<{ items?: YTCommentThread[] }>(
            "commentThreads",
            { part: "snippet", videoId, order, maxResults: String(COMMENTS_PER_ORDERING), textFormat: "plainText" },
            apiKey
          );
          for (const t of threads?.items ?? []) {
            const top = t.snippet.topLevelComment;
            const sourceId = `yt-comment-${top.id}`;
            if (records.has(sourceId)) continue;
            records.set(sourceId, {
              platform: "youtube",
              sourceId,
              game: game.id,
              author: top.snippet.authorDisplayName,
              content: top.snippet.textOriginal,
              publishedAt: new Date(top.snippet.publishedAt),
              rawData: {
                type: "comment",
                videoId,
                videoTitle: upload.snippet.title,
                channelTitle: channel.snippet.title,
                channelCountry: channel.snippet.country,
                language: channel.snippet.defaultLanguage,
                likeCount: top.snippet.likeCount,
                replyCount: t.snippet.totalReplyCount,
                url: `https://www.youtube.com/watch?v=${videoId}&lc=${top.id}`,
              },
              isSample: false,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[youtube] channel ${channelId} collection failed:`, err);
    }
  }

  return [...records.values()];
}

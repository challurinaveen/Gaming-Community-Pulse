import type { GameConfig } from "@/lib/config/games";
import type { RawRecord } from "@/lib/collectors/types";

const API_BASE = "https://discord.com/api/v10";
const DEFAULT_MESSAGE = 0;
const REPLY_MESSAGE = 19;

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  timestamp: string;
  reactions?: { count: number }[];
  message_reference?: { message_id?: string };
  type: number;
}

async function discordGet<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  if (!res.ok) {
    console.error(`[discord] GET ${path} failed: ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

/** Latest 100 messages per configured channel the bot can read. Reply counts are counted within the fetched window. */
export async function collectDiscord(game: GameConfig): Promise<RawRecord[]> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelIds = game.discord.channelIds ?? [];
  if (!token || channelIds.length === 0) return [];

  const guildId = game.discord.guildId;
  const guild = guildId ? await discordGet<{ preferred_locale?: string }>(`/guilds/${guildId}`, token) : null;

  const records: RawRecord[] = [];
  for (const channelId of channelIds) {
    try {
      const messages = (await discordGet<DiscordMessage[]>(`/channels/${channelId}/messages?limit=100`, token)) ?? [];

      const replyCounts = new Map<string, number>();
      for (const m of messages) {
        const parent = m.message_reference?.message_id;
        if (parent) replyCounts.set(parent, (replyCounts.get(parent) ?? 0) + 1);
      }

      for (const msg of messages) {
        if (msg.type !== DEFAULT_MESSAGE && msg.type !== REPLY_MESSAGE) continue;
        if (!msg.content || msg.author.bot) continue;
        records.push({
          platform: "discord",
          sourceId: `discord-msg-${msg.id}`,
          game: game.id,
          author: msg.author.username,
          content: msg.content,
          publishedAt: new Date(msg.timestamp),
          rawData: {
            type: "message",
            channelId,
            reactionCount: (msg.reactions ?? []).reduce((sum, r) => sum + r.count, 0),
            replyCount: replyCounts.get(msg.id) ?? 0,
            guildLocale: guild?.preferred_locale,
            url: guildId ? `https://discord.com/channels/${guildId}/${channelId}/${msg.id}` : undefined,
          },
          isSample: false,
        });
      }
    } catch (err) {
      console.error(`[discord] channel ${channelId} collection failed:`, err);
    }
  }
  return records;
}

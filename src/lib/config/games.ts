// ---------------------------------------------------------------------------
// Game configuration: which sources to collect per game
// ---------------------------------------------------------------------------

import type { Platform } from "@/lib/platforms";
import type { Region } from "@/lib/analysis/region";

export type KnownRegion = Exclude<Region, "Undetermined">;

export interface GameConfig {
  id: string;
  name: string;
  /** Extra title keywords used to tell this game's uploads apart from a channel's other content. */
  aliases?: string[];
  youtube: { channelIds: string[] };
  reddit: { subreddits: string[] };
  discord: { guildId?: string; channelIds?: string[] };
  twitch: { categoryId?: string; categoryName: string };
  /**
   * Region signal 2 (report Table 4, confidence 0.90): the known audience region of a source,
   * e.g. `{ discord: "Europe" }` for an EU community server. Only set it when you actually know;
   * a YouTube channel's declared country still takes priority.
   */
  sourceRegions?: Partial<Record<Platform, KnownRegion>>;
}

/** Lower-cased title keywords identifying a game: its name plus any configured aliases. */
export function gameAliases(game: GameConfig): string[] {
  return [game.name, ...(game.aliases ?? [])].map((a) => a.toLowerCase());
}

export const GAMES: GameConfig[] = [
  {
    id: "genshin-impact",
    name: "Genshin Impact",
    aliases: ["genshin", "teyvat", "natlan", "nod-krai"],
    youtube: {
      // Genshin Impact (official) - country=US
      channelIds: ["UCiS882YPwZt1NfaM0gR0D9Q"],
    },
    reddit: { subreddits: ["Genshin_Impact"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "Genshin Impact" },
  },
  {
    id: "valorant",
    name: "Valorant",
    aliases: ["valorant", "vct", "radiant", "agent"],
    youtube: {
      // VALORANT (official) - country=US, 2.96M subs.
      // Was UCA1d3HFGFUmkKr2JIUA5Vlw (VCT esports): match VODs drew only 15 comment
      // threads across 8 videos. The main channel yields ~187. See 6.9.
      channelIds: ["UC8CX0LD98EDXl4UYX1MDCXg"],
    },
    reddit: { subreddits: ["VALORANT"] },
    discord: {
      // naveroll's server (test server): #general, #clips-and-highlights.
      // Add real community servers here once their admins have invited the bot.
      guildId: "1049606771393703966",
      channelIds: ["1049606771909591111", "1049606771909591112"],
    },
    twitch: { categoryName: "VALORANT" },
  },
  {
    id: "fortnite",
    name: "Fortnite",
    aliases: ["fortnite", "royale"],
    youtube: {
      // Fortnite (official) - country=US
      channelIds: ["UClG8odDC8TS6Zpqk9CGVQiQ"],
    },
    reddit: { subreddits: ["FortNiteBR"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "Fortnite" },
  },
  {
    id: "elden-ring",
    name: "Elden Ring",
    aliases: ["elden", "erdtree", "nightreign", "tarnished"],
    youtube: {
      // VaatiVidya (creator) - country=AU, 3.34M subs, 48/50 recent uploads on-topic.
      // No official option exists: FromSoftware has comments disabled on every video,
      // so a creator channel is required for this game. See 6.9.
      channelIds: ["UCe0DNp0mKMqrYVaTundyr9w"],
    },
    reddit: { subreddits: ["Eldenring"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "Elden Ring" },
  },
  {
    id: "league-of-legends",
    name: "League of Legends",
    aliases: ["league of legends", "lol", "lec", "lck", "worlds", "msi", "rift", "champion"],
    youtube: {
      // League of Legends (official) - country=US, 15.9M subs.
      // Was UCvqRdlKsE5Q8mf8YXbdIJLw (LoL Esports): 97 threads and no country field,
      // so the 0.95 region signal could not fire. The main channel fixes both. See 6.9.
      channelIds: ["UC2t5bjwHdUX4vM2g8TRDq5g"],
    },
    reddit: { subreddits: ["leagueoflegends"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "League of Legends" },
  },
];

// ---------------------------------------------------------------------------
// Game configuration: which sources to collect per game
// ---------------------------------------------------------------------------

export interface GameConfig {
  id: string;
  name: string;
  youtube: { channelIds: string[] };
  reddit: { subreddits: string[] };
  discord: { guildId?: string; channelIds?: string[] };
  twitch: { categoryId?: string; categoryName: string };
}

export const GAMES: GameConfig[] = [
  {
    id: "genshin-impact",
    name: "Genshin Impact",
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
    youtube: {
      // VALORANT Champions Tour (official) - country=US
      channelIds: ["UCA1d3HFGFUmkKr2JIUA5Vlw"],
    },
    reddit: { subreddits: ["VALORANT"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "VALORANT" },
  },
  {
    id: "fortnite",
    name: "Fortnite",
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
    youtube: {
      // FromSoftware, Inc. (developer) - country=JP
      channelIds: ["UCCkxMbfZ80VFwwiRlIG5P5g"],
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
    youtube: {
      // LoL Esports (official) - no country field exposed, so the 0.95 region signal
      // cannot fire for this game and it falls through to the language signals.
      channelIds: ["UCvqRdlKsE5Q8mf8YXbdIJLw"],
    },
    reddit: { subreddits: ["leagueoflegends"] },
    discord: {
      // Fill in the server (guild) ID and channel IDs the RS bot has been invited to read.
      channelIds: [],
    },
    twitch: { categoryName: "League of Legends" },
  },
];

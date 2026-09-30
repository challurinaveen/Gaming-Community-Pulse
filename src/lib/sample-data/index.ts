import type { RawRecord } from "@/lib/collectors/types";

// ---------------------------------------------------------------------------
// Realistic sample data for development and demo purposes
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;

/** Spreads records over the trailing days, always in the past; the counter varies the hour within a day. */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * HOUR - (1 + ((sampleCounter * 5) % 20)) * HOUR);
}

export function getSampleData(): RawRecord[] {
  sampleCounter = 0;
  const records: RawRecord[] = [
    // -----------------------------------------------------------------------
    // YouTube
    // -----------------------------------------------------------------------
    s("youtube", "genshin-impact", "TenTenGenshin", "This new update is absolutely cracked, best patch ever", daysAgo(1), { type: "comment", likeCount: 342, replyCount: 18 }),
    s("youtube", "genshin-impact", "GenshinFanatic", "the new character design is insane, take my money", daysAgo(1), { type: "comment", likeCount: 891, replyCount: 45 }),
    s("youtube", "genshin-impact", "F2PBtw", "Can someone explain why my pity reset? This gacha system is rigged I swear", daysAgo(2), { type: "comment", likeCount: 56, replyCount: 23 }),
    s("youtube", "genshin-impact", "PrimoGem_Hoarder", "not bad for a free update honestly", daysAgo(3), { type: "comment", likeCount: 127, replyCount: 4 }),
    s("youtube", "valorant", "RadiantPlayer99", "Chamber nerf was long overdue, now fix the servers please", daysAgo(1), { type: "comment", likeCount: 1204, replyCount: 89 }),
    s("youtube", "valorant", "TacticalFPS", "New agent abilities look balanced on paper but watch them be broken in ranked", daysAgo(2), { type: "comment", likeCount: 445, replyCount: 32 }),
    s("youtube", "fortnite", "BuildMaster2K", "oh great another battle pass nobody asked for", daysAgo(1), { type: "comment", likeCount: 2103, replyCount: 156 }),
    s("youtube", "fortnite", "CasualGamerMom", "My kids are obsessed with the new collab skin ngl it looks amazing", daysAgo(2), { type: "comment", likeCount: 312, replyCount: 8 }),
    s("youtube", "elden-ring", "SoulsVeteran", "This DLC boss might be the hardest From Software has ever made and I love it", daysAgo(1), { type: "comment", likeCount: 1567, replyCount: 203 }),
    s("youtube", "league-of-legends", "MidDiffGap", "dead game lol", daysAgo(1), { type: "comment", likeCount: 87, replyCount: 44 }),

    // -----------------------------------------------------------------------
    // Reddit
    // -----------------------------------------------------------------------
    s("reddit", "genshin-impact", "u/AstralTraveler", "Unpopular opinion: the exploration in this game peaked in 2.0 and they haven't matched it since", daysAgo(1), { type: "post", ups: 4521, num_comments: 389, score: 4521 }),
    s("reddit", "genshin-impact", "u/WaifuCollector", "New character leaked and she looks absolutely gorgeous, here are the datamined animations", daysAgo(2), { type: "post", ups: 12045, num_comments: 834, score: 12045 }),
    s("reddit", "genshin-impact", "u/MetaBuilder", "Is anyone else getting constant crashes since the hotfix?", daysAgo(3), { type: "post", ups: 876, num_comments: 234, score: 876 }),
    s("reddit", "genshin-impact", "u/CasualEnjoyer", "I just want to say the music team never misses. Every single track is a banger.", daysAgo(2), { type: "comment", ups: 2341, score: 2341 }),
    s("reddit", "valorant", "u/ImmortalRank", "The anti-cheat needs a serious overhaul. Three cheaters in my last five games.", daysAgo(1), { type: "post", ups: 8934, num_comments: 1205, score: 8934 }),
    s("reddit", "valorant", "u/SilverSurfer", "Hot take: this is the most balanced the game has ever been right now", daysAgo(2), { type: "post", ups: 2341, num_comments: 567, score: 2341 }),
    s("reddit", "valorant", "u/ClutchOrKick", "Finally hit Diamond after 3 acts of grinding, the new rank system actually feels fair", daysAgo(3), { type: "comment", ups: 445, score: 445 }),
    s("reddit", "fortnite", "u/OGPlayer", "Remember when this game was about building? Now it's just a brand deal simulator", daysAgo(1), { type: "post", ups: 15678, num_comments: 2341, score: 15678 }),
    s("reddit", "fortnite", "u/NoSweatDefault", "The no-build mode saved this game for casuals like me and I'm grateful", daysAgo(2), { type: "comment", ups: 3456, score: 3456 }),
    s("reddit", "fortnite", "u/CompetitiveFN", "Can we talk about how broken the new mythic shotgun is? 200 damage headshot with no skill required", daysAgo(1), { type: "post", ups: 5678, num_comments: 890, score: 5678 }),
    s("reddit", "elden-ring", "u/LoreHunter", "Found a hidden interaction between two NPC questlines that I've never seen documented anywhere", daysAgo(1), { type: "post", ups: 23456, num_comments: 1567, score: 23456 }),
    s("reddit", "elden-ring", "u/CasualTarnished", "120 hours in and I just discovered you can two-hand weapons. This game keeps giving.", daysAgo(2), { type: "post", ups: 34567, num_comments: 2890, score: 34567 }),
    s("reddit", "elden-ring", "u/GitGudScrub", "Malenia is still the most unfair boss design in any Souls game. RNG moveset is not difficulty.", daysAgo(3), { type: "comment", ups: 1234, score: 1234 }),
    s("reddit", "league-of-legends", "u/ADCInPain", "Bot lane has zero agency in this meta and it's been like this for three patches now", daysAgo(1), { type: "post", ups: 6789, num_comments: 1456, score: 6789 }),
    s("reddit", "league-of-legends", "u/JungleDiff", "The new jungle changes actually made the role fun again, props to the balance team", daysAgo(2), { type: "comment", ups: 890, score: 890 }),

    // -----------------------------------------------------------------------
    // Discord
    // -----------------------------------------------------------------------
    s("discord", "genshin-impact", "Keqing_Main", "Anyone doing Abyss floor 12 tonight? Need a carry lmao", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 3, replyCount: 0 }),
    s("discord", "genshin-impact", "ArtifactHell", "400 resin spent on the domain and not a single good piece. This game hates me.", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 12, replyCount: 3 }),
    s("discord", "valorant", "IGL_Callouts", "Viper wall smoke lineups for the new map if anyone needs them", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 28, replyCount: 0 }),
    s("discord", "valorant", "FragHunter", "just got an ace with the classic pistol on round 1 im literally shaking", daysAgo(1), { type: "message", channelId: "sample", reactionCount: 45, replyCount: 0 }),
    s("discord", "fortnite", "SweatyBuild", "The new season is so much fun, actually can't stop playing", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 7, replyCount: 0 }),
    s("discord", "fortnite", "LootLlama", "Did they stealth nerf the drop rates? I'm getting way less gold loot than before", daysAgo(1), { type: "message", channelId: "sample", reactionCount: 15, replyCount: 3 }),
    s("discord", "elden-ring", "SummonSign", "SL 150 coop anyone? Stuck on this boss for literally 4 hours", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 6, replyCount: 0 }),
    s("discord", "elden-ring", "InvaderDave", "PvP at the academy gate is peak gaming right now, so many creative builds", daysAgo(1), { type: "message", channelId: "sample", reactionCount: 19, replyCount: 0 }),
    s("discord", "league-of-legends", "SupportMain", "Why does nobody buy control wards in Gold elo, I'm losing my mind", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 34, replyCount: 0 }),
    s("discord", "league-of-legends", "TopDiffGG", "New champ is so overtuned it's actually hilarious. 60% winrate day one.", daysAgo(0), { type: "message", channelId: "sample", reactionCount: 52, replyCount: 3 }),

    // -----------------------------------------------------------------------
    // Twitch
    // -----------------------------------------------------------------------
    s("twitch", "genshin-impact", "GachaStreamer", "C6 R5 WHALE PULL SESSION - NEW CHARACTER BANNER", daysAgo(0), { type: "clip", view_count: 45230 }),
    s("twitch", "genshin-impact", "CozyGenshin", "chill exploration stream, just vibing and doing dailies", daysAgo(1), { type: "stream", view_count: 1234 }),
    s("twitch", "valorant", "ProPlayerVAL", "RANKED GRIND TO IMMORTAL - DAY 5", daysAgo(0), { type: "stream", view_count: 15678 }),
    s("twitch", "valorant", "ClipMachine", "INSANE 1v5 ACE CLUTCH WITH JETT", daysAgo(1), { type: "clip", view_count: 234567 }),
    s("twitch", "fortnite", "BuildKingFN", "Arena grind + viewer games later!", daysAgo(0), { type: "stream", view_count: 8901 }),
    s("twitch", "fortnite", "CasualVibes", "Just having fun with the new season, come hang out", daysAgo(1), { type: "stream", view_count: 456 }),
    s("twitch", "elden-ring", "NoHitRun", "ATTEMPTING NO HIT RUN #47 - WE GO AGAIN", daysAgo(0), { type: "stream", view_count: 67890 }),
    s("twitch", "elden-ring", "LoreExplorer", "Finding every hidden secret in the DLC", daysAgo(2), { type: "stream", view_count: 3456 }),
    s("twitch", "league-of-legends", "ChallengerJG", "CHALLENGER JUNGLE EDUCATIONAL STREAM", daysAgo(0), { type: "stream", view_count: 12345 }),
    s("twitch", "league-of-legends", "PentakillHighlights", "THE MOST INSANE BARON STEAL YOU WILL EVER SEE", daysAgo(1), { type: "clip", view_count: 567890 }),
  ];

  return records;
}

// ---------------------------------------------------------------------------
// Helper to construct a sample RawRecord with less repetition
// ---------------------------------------------------------------------------

// Illustrative publisher-side region signals, rotated so the demo region view isn't empty.
// Reddit gets none, matching the real API (it exposes no publisher country).
const SAMPLE_SIGNALS: Record<RawRecord["platform"], Record<string, string>[]> = {
  youtube: [{ channelCountry: "US" }, { channelCountry: "GB" }, { channelCountry: "JP" }, { channelCountry: "BR" }, { channelCountry: "KR" }],
  discord: [{ guildLocale: "en-US" }, { guildLocale: "en-GB" }, { guildLocale: "de" }, { guildLocale: "pt-BR" }],
  twitch: [{ language: "en" }, { language: "ko" }, { language: "es" }, { language: "zh" }],
  reddit: [{}],
};

let sampleCounter = 0;

function s(
  platform: RawRecord["platform"],
  game: string,
  author: string,
  content: string,
  publishedAt: Date,
  rawData: Record<string, unknown>
): RawRecord {
  sampleCounter++;
  const signals = SAMPLE_SIGNALS[platform];
  return {
    platform,
    sourceId: `sample-${platform}-${sampleCounter}`,
    game,
    author,
    content,
    publishedAt,
    rawData: { ...signals[sampleCounter % signals.length], ...rawData },
    isSample: true,
  };
}
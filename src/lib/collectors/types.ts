// ---------------------------------------------------------------------------
// Shared types for the data-collection layer
// ---------------------------------------------------------------------------

export interface RawRecord {
  platform: "youtube" | "reddit" | "discord" | "twitch";
  sourceId: string;
  game: string;
  author: string;
  content: string;
  publishedAt: Date;
  /** Platform-specific metrics (likes, upvotes, reactions, views, etc.) */
  rawData: Record<string, unknown>;
  /** true when the record comes from the built-in sample dataset */
  isSample: boolean;
}

export interface PlatformStatus {
  platform: "youtube" | "reddit" | "discord" | "twitch";
  configured: boolean;
  recordCount: number;
  error?: string;
}

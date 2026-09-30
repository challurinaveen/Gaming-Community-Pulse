// ---------------------------------------------------------------------------
// Engagement index calculation per platform
// ---------------------------------------------------------------------------

import type { Platform } from "@/lib/db/supabase";

export interface EngagementResult {
  index: number; // 0-100
  rawSignal: number;
}

interface PlatformConfig {
  compute: (raw: Record<string, unknown>) => number;
  ceiling: number;
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  youtube: {
    compute: (raw) => {
      const likes = toNum(raw.likeCount ?? raw.likes);
      const replies = toNum(raw.replyCount ?? raw.replies);
      return likes + 3 * replies;
    },
    ceiling: 5000,
  },
  reddit: {
    compute: (raw) => {
      const upvotes = toNum(raw.ups ?? raw.upvotes ?? raw.score);
      const comments = toNum(
        raw.num_comments ?? raw.commentCount ?? raw.comments
      );
      return upvotes + 5 * comments;
    },
    ceiling: 20000,
  },
  discord: {
    compute: (raw) => {
      const reactions = toNum(raw.reactionCount ?? raw.reactions);
      const replies = toNum(raw.replyCount ?? raw.replies);
      return reactions + 2 * replies;
    },
    ceiling: 40,
  },
  twitch: {
    compute: (raw) => {
      return toNum(raw.view_count ?? raw.viewCount);
    },
    ceiling: 500000,
  },
};

export const ENGAGEMENT_CEILINGS = Object.fromEntries(
  Object.entries(PLATFORM_CONFIG).map(([platform, c]) => [platform, c.ceiling])
) as Record<Platform, number>;

/**
 * Calculate engagement index for a record.
 *
 * Formula: min(100, (log(1 + rawSignal) / log(1 + ceiling)) * 100)
 *
 * Returns both the 0-100 index and the raw weighted signal.
 */
export function calculateEngagement(
  platform: string,
  rawData: Record<string, unknown>
): EngagementResult {
  const config = PLATFORM_CONFIG[platform as Platform];

  if (!config) {
    return { index: 0, rawSignal: 0 };
  }

  const rawSignal = Math.max(0, config.compute(rawData));
  const index = Math.min(
    100,
    (Math.log(1 + rawSignal) / Math.log(1 + config.ceiling)) * 100
  );

  return {
    index: Number(index.toFixed(1)),
    rawSignal,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

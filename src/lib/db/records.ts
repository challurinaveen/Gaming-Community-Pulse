import { getSupabase, CommunityRecord, Platform } from "@/lib/db/supabase";

export type NewCommunityRecord = Omit<CommunityRecord, "id" | "collected_at">;

export interface GetRecordsByGameOptions {
  platform?: Platform;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Upsert keyed on (platform, source_id). Returns the number written, 0 when storage is unconfigured. */
export async function saveRecords(records: NewCommunityRecord[]): Promise<number> {
  const db = getSupabase();
  if (!db || records.length === 0) return 0;
  const { error } = await db.from("community_records").upsert(records, { onConflict: "platform,source_id" });
  if (error) throw error;
  return records.length;
}

export interface StoredSentiment {
  score: number;
  confidence: number;
  sarcasm: boolean;
  theme: string;
  isQuestion: boolean;
  isRisk: boolean;
}

const LOOKUP_CHUNK = 150;

/**
 * Claude scores already stored for these source IDs, so a refresh only pays to score posts it hasn't seen.
 * Lexicon-scored rows are not returned: they get another chance with Claude.
 */
export async function getStoredSentiment(sourceIds: string[]): Promise<Map<string, StoredSentiment>> {
  const found = new Map<string, StoredSentiment>();
  const db = getSupabase();
  if (!db || sourceIds.length === 0) return found;
  for (let i = 0; i < sourceIds.length; i += LOOKUP_CHUNK) {
    const { data, error } = await db
      .from("community_records")
      .select("source_id, sentiment_score, sentiment_confidence, sarcasm_flag, theme, is_question, is_risk")
      .eq("sentiment_engine", "semantic")
      .in("source_id", sourceIds.slice(i, i + LOOKUP_CHUNK));
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.sentiment_score === null) continue;
      found.set(r.source_id, {
        score: r.sentiment_score,
        confidence: r.sentiment_confidence ?? 0,
        sarcasm: r.sarcasm_flag,
        theme: r.theme ?? "other",
        isQuestion: r.is_question,
        isRisk: r.is_risk,
      });
    }
  }
  return found;
}

/**
 * Deletes a platform's archived records first collected more than `days` ago.
 * Upserts never touch collected_at, so the clock runs from first collection.
 */
export async function deleteExpiredRecords(platform: Platform, days: number): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count, error } = await db
    .from("community_records")
    .delete({ count: "exact" })
    .eq("platform", platform)
    .lt("collected_at", cutoff);
  if (error) throw error;
  return count ?? 0;
}

export async function getRecordsByGame(
  game: string,
  { platform, from, to, limit = 100, offset = 0 }: GetRecordsByGameOptions = {}
): Promise<CommunityRecord[]> {
  const db = getSupabase();
  if (!db) return [];
  let query = db
    .from("community_records")
    .select("*")
    .eq("game", game)
    .order("collected_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (platform) query = query.eq("platform", platform);
  if (from) query = query.gte("collected_at", from);
  if (to) query = query.lte("collected_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data as CommunityRecord[]) ?? [];
}

export async function getRecordCount(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;
  const { count, error } = await db.from("community_records").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

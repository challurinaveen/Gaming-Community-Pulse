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

import { getSupabase, DailySnapshot } from "@/lib/db/supabase";

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

/** Upsert keyed on date, so re-running a day's pipeline is idempotent. Returns false when storage is unconfigured. */
export async function saveSnapshot(data: Omit<DailySnapshot, "generated_at">): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db
    .from("daily_snapshots")
    .upsert({ ...data, generated_at: new Date().toISOString() }, { onConflict: "date" });
  if (error) throw error;
  return true;
}

export async function getSnapshot(date: string): Promise<DailySnapshot | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from("daily_snapshots").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return (data as DailySnapshot) ?? null;
}

/** Most recent snapshot strictly before `date`, used for day-over-day deltas. */
export async function getPreviousSnapshot(date: string): Promise<DailySnapshot | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("daily_snapshots")
    .select("*")
    .lt("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as DailySnapshot) ?? null;
}

/** Newest first. */
export async function getRecentSnapshots(days: number): Promise<DailySnapshot[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("daily_snapshots")
    .select("*")
    .gte("date", isoDaysAgo(days))
    .order("date", { ascending: false });
  if (error) throw error;
  return (data as DailySnapshot[]) ?? [];
}

export async function pruneOldSnapshots(retentionDays = 90): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;
  const { count, error } = await db
    .from("daily_snapshots")
    .delete({ count: "exact" })
    .lt("date", isoDaysAgo(retentionDays));
  if (error) throw error;
  return count ?? 0;
}

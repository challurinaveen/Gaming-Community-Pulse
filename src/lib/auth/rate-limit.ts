import { getSupabase } from "@/lib/db/supabase";

// Attempt counters live in Supabase (auth_rate_limits + record_auth_attempt, see
// supabase/002_auth_rate_limits.sql) so every serverless instance shares them. If that table
// isn't there yet, an in-memory counter keeps sign-in working and throttled per instance.

interface Window {
  count: number;
  start: number;
}

const memory = new Map<string, Window>();
const MEMORY_PRUNE_AT = 5_000;
const DAY_MS = 86_400_000;
let warnedFallback = false;

function fallback(reason: string) {
  if (!warnedFallback) {
    console.warn(`[rate-limit] using per-instance memory (${reason}); run supabase/002_auth_rate_limits.sql to share limits`);
    warnedFallback = true;
  }
}

function memoryCount(key: string, windowMs: number): number {
  const w = memory.get(key);
  return w && Date.now() - w.start < windowMs ? w.count : 0;
}

/** True when `key` already has `max` or more attempts inside the current window. Does not count an attempt. */
export async function isRateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db.from("auth_rate_limits").select("count, window_start").eq("key", key).maybeSingle();
    if (!error) {
      if (!data) return false;
      const inWindow = Date.now() - Date.parse(data.window_start) < windowMs;
      return inWindow && data.count >= max;
    }
    fallback(error.message);
  }
  return memoryCount(key, windowMs) >= max;
}

/** Counts one attempt against `key`. */
export async function recordAttempt(key: string, windowMs: number): Promise<void> {
  const db = getSupabase();
  if (db) {
    const { error } = await db.rpc("record_auth_attempt", { p_key: key, p_window_seconds: Math.ceil(windowMs / 1000) });
    if (!error) return;
    fallback(error.message);
  }
  const now = Date.now();
  if (memory.size > MEMORY_PRUNE_AT) {
    for (const [k, w] of memory) if (now - w.start > DAY_MS) memory.delete(k);
  }
  const w = memory.get(key);
  if (w && now - w.start < windowMs) w.count += 1;
  else memory.set(key, { count: 1, start: now });
}

/** Forgets the attempts for these keys (after a successful sign-in). */
export async function clearAttempts(...keys: string[]): Promise<void> {
  for (const key of keys) memory.delete(key);
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("auth_rate_limits").delete().in("key", keys);
    if (error) fallback(error.message);
  }
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types mirroring the database tables
// ---------------------------------------------------------------------------

export interface DailySnapshot {
  date: string; // ISO date string (YYYY-MM-DD)
  generated_at: string;
  overall: Record<string, unknown> | null;
  games_summary: Record<string, unknown> | null;
  platform_summary: Record<string, unknown> | null;
  region_summary: Record<string, unknown> | null;
  themes: Record<string, unknown> | null;
  risk_count: number;
}

export type Platform = "youtube" | "reddit" | "discord" | "twitch";
export type SentimentEngine = "semantic" | "lexicon";

export interface CommunityRecord {
  id: string;
  platform: Platform;
  source_id: string;
  game: string;
  author: string | null;
  content: string | null;
  raw_data: Record<string, unknown> | null;
  sentiment_score: number | null;
  sentiment_confidence: number | null;
  sentiment_engine: SentimentEngine | null;
  sarcasm_flag: boolean;
  theme: string | null;
  is_question: boolean;
  is_risk: boolean;
  engagement_index: number | null;
  region: string | null;
  region_confidence: number | null;
  collected_at: string;
  published_at: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase client (server-side, service role key)
// ---------------------------------------------------------------------------

let client: SupabaseClient | null = null;

// The report (Appendix A) names these SUPABASE_URL / SUPABASE_SECRET_KEY; both spellings are accepted.
const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}

// Returns null when storage isn't configured, so callers can degrade instead of crashing.
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  // Accept a pasted API endpoint (".../rest/v1/") as well as the bare project URL.
  client = createClient(new URL(url).origin, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

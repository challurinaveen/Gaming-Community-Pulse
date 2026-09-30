-- Gaming Community Pulse — initial schema migration

-- ============================================================
-- 1. daily_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
  date           date        PRIMARY KEY,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  overall        jsonb,
  games_summary  jsonb,
  platform_summary jsonb,
  region_summary jsonb,
  themes         jsonb,
  risk_count     integer     NOT NULL DEFAULT 0
);

-- ============================================================
-- 2. community_records
-- ============================================================
CREATE TABLE IF NOT EXISTS community_records (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform             text        NOT NULL CHECK (platform IN ('youtube', 'reddit', 'discord', 'twitch')),
  source_id            text        NOT NULL,
  game                 text        NOT NULL,
  author               text,
  content              text,
  raw_data             jsonb,
  sentiment_score      integer     CHECK (sentiment_score BETWEEN -100 AND 100),
  sentiment_confidence real,
  sentiment_engine     text        CHECK (sentiment_engine IN ('semantic', 'lexicon')),
  sarcasm_flag         boolean     NOT NULL DEFAULT false,
  theme                text,
  is_question          boolean     NOT NULL DEFAULT false,
  is_risk              boolean     NOT NULL DEFAULT false,
  engagement_index     real,
  region               text,
  region_confidence    real,
  collected_at         timestamptz NOT NULL DEFAULT now(),
  published_at         timestamptz,
  UNIQUE (platform, source_id)
);

-- Indexes on community_records
CREATE INDEX IF NOT EXISTS idx_community_records_platform
  ON community_records (platform);

CREATE INDEX IF NOT EXISTS idx_community_records_game
  ON community_records (game);

CREATE INDEX IF NOT EXISTS idx_community_records_collected_at
  ON community_records (collected_at);

-- (platform, source_id) is already indexed by its UNIQUE constraint.

-- ============================================================
-- 3. app_users
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        UNIQUE NOT NULL,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Access control
-- RLS on every table with no permissive policies: the public anon key can read or write nothing.
-- Only the server-side service role key (which bypasses RLS) touches these tables.
-- ============================================================
ALTER TABLE daily_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users         ENABLE ROW LEVEL SECURITY;

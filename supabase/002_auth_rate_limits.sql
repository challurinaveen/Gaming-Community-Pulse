-- Gaming Community Pulse — shared sign-in throttling (run once, after migration.sql)
--
-- Counts failed sign-ins (and registration attempts) per key in the database instead of
-- per server instance, so throttling holds on serverless hosting. Safe to run more than once.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key          text        PRIMARY KEY,
  count        integer     NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Same access model as the other tables: RLS on, no policies, service role only.
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically counts one attempt, starting a fresh window when the previous one has expired.
-- In ON CONFLICT DO UPDATE every SET expression sees the old row, so both CASEs agree.
CREATE OR REPLACE FUNCTION record_auth_attempt(p_key text, p_window_seconds integer)
RETURNS integer
LANGUAGE sql
AS $$
  INSERT INTO auth_rate_limits AS r (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.count + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
  RETURNING count;
$$;

-- Only the server (service role) may call it; the public anon key must not be able to lock accounts.
REVOKE ALL ON FUNCTION record_auth_attempt(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_auth_attempt(text, integer) TO service_role;

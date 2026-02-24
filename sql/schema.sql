-- ============================================================
-- InsForge Analytics Dashboard – Database Schema
-- Run this in your InsForge SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Raw analytics events
CREATE TABLE IF NOT EXISTS events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT        NOT NULL,
  user_id      TEXT,
  session_id   TEXT,
  page         TEXT,
  referrer     TEXT,
  properties   JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-aggregated hourly buckets (maintained by the app layer)
CREATE TABLE IF NOT EXISTS event_hourly_stats (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   TEXT        NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,  -- truncated to the hour
  count        INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (event_name, bucket_start)
);

-- AI-generated insight records
CREATE TABLE IF NOT EXISTS ai_insights (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT        NOT NULL DEFAULT 'trend',   -- 'trend' | 'anomaly' | 'summary'
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  time_range   TEXT        NOT NULL DEFAULT '24h',     -- '1h' | '24h' | '7d'
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_created_at   ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_name   ON events (event_name);
CREATE INDEX IF NOT EXISTS idx_events_user_id      ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id   ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_properties   ON events USING GIN (properties);

CREATE INDEX IF NOT EXISTS idx_hourly_stats_bucket ON event_hourly_stats (bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON ai_insights (created_at DESC);

-- ── Helper function: upsert hourly bucket ─────────────────────
-- Called from the app layer after each event insert.
CREATE OR REPLACE FUNCTION upsert_hourly_stat(
  p_event_name TEXT,
  p_ts         TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  INSERT INTO event_hourly_stats (event_name, bucket_start, count)
  VALUES (p_event_name, date_trunc('hour', p_ts), 1)
  ON CONFLICT (event_name, bucket_start)
  DO UPDATE SET count = event_hourly_stats.count + 1;
END;
$$ LANGUAGE plpgsql;

-- ── Seed: demo events for quick preview ───────────────────────
-- (Remove in production)
INSERT INTO events (event_name, user_id, session_id, page, properties, created_at)
SELECT
  (ARRAY['page_view','click','signup','purchase','search'])[ceil(random()*5)::int],
  'user_' || (floor(random()*200)+1)::text,
  'sess_' || (floor(random()*500)+1)::text,
  (ARRAY['/','/ pricing','/docs','/blog','/signup'])[ceil(random()*5)::int],
  jsonb_build_object('country', (ARRAY['US','UK','DE','FR','JP'])[ceil(random()*5)::int]),
  NOW() - (random() * INTERVAL '7 days')
FROM generate_series(1, 500)
ON CONFLICT DO NOTHING;

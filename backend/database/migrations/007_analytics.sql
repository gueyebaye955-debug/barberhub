CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(80) NOT NULL,
  page VARCHAR(120) NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip INET,
  user_agent TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_events (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(80) NOT NULL DEFAULT 'client',
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  page VARCHAR(120) NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uptime_checks (
  id BIGSERIAL PRIMARY KEY,
  target VARCHAR(120) NOT NULL,
  ok BOOLEAN NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created_at
  ON analytics_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_events_created_at
  ON error_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_created_at
  ON uptime_checks(created_at DESC);

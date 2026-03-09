CREATE TABLE IF NOT EXISTS billing_payments (
  id          SERIAL PRIMARY KEY,
  barber_id   INTEGER NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL DEFAULT 0,
  month       VARCHAR(7) NOT NULL,  -- e.g. '2026-03'
  paid        BOOLEAN NOT NULL DEFAULT false,
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(barber_id, month)
);

CREATE TABLE IF NOT EXISTS barber_portfolio_photos (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barber_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption VARCHAR(160) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barber_portfolio_barber_sort
  ON barber_portfolio_photos(barber_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_barber_portfolio_barber_created
  ON barber_portfolio_photos(barber_id, created_at DESC);

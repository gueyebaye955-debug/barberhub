ALTER TABLE barber_profiles
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE barber_profiles
  ADD COLUMN IF NOT EXISTS lunch_break_start TIME;

ALTER TABLE barber_profiles
  ADD COLUMN IF NOT EXISTS lunch_break_end TIME;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'barber_profiles_lunch_window_check'
  ) THEN
    ALTER TABLE barber_profiles
      ADD CONSTRAINT barber_profiles_lunch_window_check
      CHECK (
        lunch_break_start IS NULL
        OR lunch_break_end IS NULL
        OR lunch_break_start < lunch_break_end
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_barber_date_status ON bookings(barber_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);

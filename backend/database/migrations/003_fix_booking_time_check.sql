ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_time_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_time_check
  CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

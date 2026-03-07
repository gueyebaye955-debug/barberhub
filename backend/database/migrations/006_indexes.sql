-- Performance indexes for large-scale queries
CREATE INDEX IF NOT EXISTS idx_barber_profiles_city ON barber_profiles(city);
CREATE INDEX IF NOT EXISTS idx_barber_profiles_rating ON barber_profiles(rating DESC);
CREATE INDEX IF NOT EXISTS idx_barber_profiles_approved ON users(approved, role);
CREATE INDEX IF NOT EXISTS idx_services_barber_id ON services(barber_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(LOWER(category));
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date ON bookings(barber_id, date);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, read);

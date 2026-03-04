-- BarberHub Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  city VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'barber', 'admin')),
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barber_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(150),
  bio TEXT,
  city VARCHAR(100),
  address VARCHAR(255),
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  rating NUMERIC(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  avatar TEXT,
  travel_buffer_minutes INTEGER NOT NULL DEFAULT 0,
  lunch_break_start TIME,
  lunch_break_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT barber_profiles_lunch_window_check CHECK (
    lunch_break_start IS NULL
    OR lunch_break_end IS NULL
    OR lunch_break_start < lunch_break_end
  )
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER REFERENCES barber_profiles(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  "desc" TEXT,
  price INTEGER NOT NULL,
  duration INTEGER DEFAULT 30,
  category VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  barber_id INTEGER REFERENCES barber_profiles(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(150),
  barber_name VARCHAR(255),
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  price INTEGER,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER REFERENCES barber_profiles(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  barber_id INTEGER REFERENCES barber_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, barber_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verify_codes (
  email VARCHAR(255) PRIMARY KEY,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bookings_barber_date_status ON bookings(barber_id, date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);

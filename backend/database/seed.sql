-- Demo seed data for JOTMA
-- Password for all demo accounts: "password"

INSERT INTO users (first_name, last_name, email, password, phone, city, role, approved) VALUES
  ('John', 'Doe', 'john@demo.com', '$2a$10$AXGXcB07/503BZGhAHb6pOi62MSX8HSXa4qLo2iKMih2duhRj9L5S', '5550001111', 'New York', 'customer', true),
  ('Carlos', 'Rivera', 'carlos@demo.com', '$2a$10$AXGXcB07/503BZGhAHb6pOi62MSX8HSXa4qLo2iKMih2duhRj9L5S', '3139896811', 'New York', 'barber', true),
  ('Admin', 'Hub', 'gueyebaye955@gmail.com', '$2a$10$MXadMmjl2aMOfEhmSzzUxO9QZBBbuUK4cIUy50drbQdz2dNkfn7nO', '', 'New York', 'admin', true),
  ('Sofia', 'Chen', 'sofia@demo.com', '$2a$10$AXGXcB07/503BZGhAHb6pOi62MSX8HSXa4qLo2iKMih2duhRj9L5S', '5552223333', 'Los Angeles', 'barber', true),
  ('Marcus', 'James', 'marcus@demo.com', '$2a$10$AXGXcB07/503BZGhAHb6pOi62MSX8HSXa4qLo2iKMih2duhRj9L5S', '5554445555', 'Chicago', 'barber', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO barber_profiles (user_id, shop_name, bio, city, address, lat, lng, rating, review_count, travel_buffer_minutes, lunch_break_start, lunch_break_end)
SELECT u.id, x.shop_name, x.bio, x.city, x.address, x.lat, x.lng, x.rating, x.review_count, x.travel_buffer_minutes, x.lunch_break_start::time, x.lunch_break_end::time
FROM (
  VALUES
    ('carlos@demo.com', 'Carlos Cuts', 'Master barber with 10+ years exp. Specializing in fades and designs.', 'New York', '123 Main St', 40.7128, -74.0060, 4.9, 127, 10, '12:30', '13:00'),
    ('sofia@demo.com', 'Sofia''s Style Lab', 'Award-winning stylist. Color specialist and precision cuts.', 'Los Angeles', '456 Sunset Blvd', 34.0522, -118.2437, 4.7, 89, 15, '13:00', '13:30'),
    ('marcus@demo.com', 'Marcus Fresh Cuts', 'Classic barbering meets modern style. Walk-ins welcome.', 'Chicago', '789 Michigan Ave', 41.8781, -87.6298, 4.5, 63, 5, '12:00', '12:30')
) AS x(email, shop_name, bio, city, address, lat, lng, rating, review_count, travel_buffer_minutes, lunch_break_start, lunch_break_end)
JOIN users u ON u.email = x.email
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO services (barber_id, name, "desc", price, duration, category)
SELECT bp.id, x.name, x."desc", x.price, x.duration, x.category
FROM (
  VALUES
    ('carlos@demo.com', 'Classic Fade', 'Clean low or mid fade with lineup', 2500, 45, 'haircut'),
    ('carlos@demo.com', 'Beard Trim', 'Shape and trim with hot towel', 1500, 30, 'beard'),
    ('carlos@demo.com', 'Full Service', 'Haircut + beard + hot towel shave', 4000, 75, 'combo'),
    ('sofia@demo.com', 'Precision Cut', 'Tailored cut to your face shape', 3500, 60, 'haircut'),
    ('sofia@demo.com', 'Color Treatment', 'Full color or highlights', 8000, 90, 'color'),
    ('marcus@demo.com', 'Skin Fade', 'High skin fade with edge up', 2800, 45, 'haircut'),
    ('marcus@demo.com', 'Hot Towel Shave', 'Traditional straight-razor shave', 2000, 30, 'shave')
) AS x(email, name, "desc", price, duration, category)
JOIN users u ON u.email = x.email
JOIN barber_profiles bp ON bp.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1
  FROM services s
  WHERE s.barber_id = bp.id
    AND s.name = x.name
);

INSERT INTO reviews (barber_id, customer_id, rating, comment)
SELECT bp.id, cu.id, x.rating, x.comment
FROM (
  VALUES
    ('carlos@demo.com', 'john@demo.com', 5, 'Best fade in the city! Carlos always delivers.'),
    ('carlos@demo.com', 'john@demo.com', 5, 'Consistent quality every time. Highly recommend.'),
    ('sofia@demo.com', 'john@demo.com', 5, 'Sofia is incredibly talented. My hair has never looked better.'),
    ('marcus@demo.com', 'john@demo.com', 4, 'Great cut, will definitely come back.')
) AS x(barber_email, customer_email, rating, comment)
JOIN users bu ON bu.email = x.barber_email
JOIN barber_profiles bp ON bp.user_id = bu.id
JOIN users cu ON cu.email = x.customer_email
WHERE NOT EXISTS (
  SELECT 1
  FROM reviews r
  WHERE r.barber_id = bp.id
    AND r.customer_id = cu.id
    AND r.comment = x.comment
);

INSERT INTO notifications (user_id, title, message)
SELECT u.id, x.title, x.message
FROM (
  VALUES
    ('john@demo.com', 'Welcome to JOTMA!', 'Book your first appointment today.'),
    ('carlos@demo.com', 'Profile approved', 'Your provider profile is now live!')
) AS x(email, title, message)
JOIN users u ON u.email = x.email
WHERE NOT EXISTS (
  SELECT 1
  FROM notifications n
  WHERE n.user_id = u.id
    AND n.title = x.title
    AND n.message = x.message
);

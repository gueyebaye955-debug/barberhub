// ============================================================
// Mock Data  BarberHub Simple
// No database needed  all data lives here + localStorage
// ============================================================

const BARBERS = [
  {
    id: 1,
    first_name: 'Carlos', last_name: 'Rivera',
    shop_name: 'Carlos Cuts Studio',
    bio: 'Professional barber with 10 years of experience. Specializing in fades, lineups, and beard grooming. I take pride in every cut.',
    phone: '3139896811',
    city: 'New York', location: '234 W 42nd St, New York, NY',
    lat: 40.7577, lng: -73.9857,
    rating: 4.9, total_reviews: 127, total_bookings: 342,
    years_experience: 10, is_verified: true,
    booked_today: 5, cancellation_hours: 24,
    avatar: 'https://i.pravatar.cc/150?img=11',
    services: [
      { id: 1, name: 'Classic Fade',  category: 'Cuts',      price: 35, duration: 45, desc: 'Clean taper fade with precision lining' },
      { id: 2, name: 'Full Haircut',  category: 'Cuts',      price: 55, duration: 60, desc: 'Wash, cut, blow dry and style' },
      { id: 3, name: 'Beard Trim',   category: 'Beard',     price: 25, duration: 30, desc: 'Shape and trim with hot towel finish' },
      { id: 4, name: 'Kids Haircut', category: 'Kids',      price: 25, duration: 30, desc: 'Haircut for children under 12' },
      { id: 5, name: 'Full Package', category: 'Specialty', price: 75, duration: 90, desc: 'Haircut + beard + scalp treatment' }
    ],
    reviews: [
      { id: 'r1', name: 'John D.',  rating: 5, comment: 'Carlos is absolutely amazing! Best fade I\'ve ever had. Will definitely be back!', date: '2024-01-15', reply: null },
      { id: 'r2', name: 'Mike T.',  rating: 5, comment: 'Beard trim was perfect. Really takes his time. Clean shop too.', date: '2024-01-10', reply: 'Thanks Mike! Always a pleasure.' },
      { id: 'r3', name: 'Alex R.',  rating: 5, comment: 'Consistent quality every single time. Best barber in NYC!', date: '2024-01-05', reply: null }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: false },
      { day: 1, label: 'Monday',    open: true, start: '09:00', end: '19:00' },
      { day: 2, label: 'Tuesday',   open: true, start: '09:00', end: '19:00' },
      { day: 3, label: 'Wednesday', open: true, start: '09:00', end: '19:00' },
      { day: 4, label: 'Thursday',  open: true, start: '09:00', end: '19:00' },
      { day: 5, label: 'Friday',    open: true, start: '09:00', end: '19:00' },
      { day: 6, label: 'Saturday',  open: true, start: '10:00', end: '18:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', caption: 'Classic Fade' },
      { url: 'https://images.unsplash.com/photo-1521490683712-35a1cb235d1c?w=800', caption: 'Beard Trim' },
      { url: 'https://images.unsplash.com/photo-1599351431613-18ef1fdd27e4?w=800', caption: 'Full Package' }
    ]
  },
  {
    id: 2,
    first_name: 'Marcus', last_name: 'Washington',
    shop_name: 'Marcus The Fade King',
    bio: 'Brooklyn native bringing authentic fade artistry. Known for crisp lineups and clean tapers. Walk-ins welcome on weekdays.',
    city: 'Brooklyn', location: '789 Flatbush Ave, Brooklyn, NY',
    lat: 40.6501, lng: -73.9496,
    rating: 4.75, total_reviews: 89, total_bookings: 210,
    years_experience: 7, is_verified: true,
    booked_today: 3, cancellation_hours: 48,
    avatar: 'https://i.pravatar.cc/150?img=33',
    services: [
      { id: 6, name: 'Skin Fade',     category: 'Cuts',      price: 40, duration: 50, desc: 'Ultra-clean skin fade with crisp lineup' },
      { id: 7, name: 'Lineup Only',   category: 'Cuts',      price: 15, duration: 20, desc: 'Edge up and lineup only' },
      { id: 8, name: 'Dreads Retwist',category: 'Specialty', price: 60, duration: 75, desc: 'Retwist and loc maintenance' },
      { id: 9, name: 'Hair Design',   category: 'Specialty', price: 50, duration: 60, desc: 'Custom hair design/artwork' }
    ],
    reviews: [
      { id: 'r4', name: 'Kevin M.',  rating: 5, comment: 'Marcus never misses. The lineup is always perfect!', date: '2024-01-18', reply: null },
      { id: 'r5', name: 'Darius L.', rating: 4, comment: 'Great fade, solid skills. Only giving 4 because of wait time.', date: '2024-01-12', reply: 'Appreciate the feedback Darius! Working on reducing wait times.' }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: false },
      { day: 1, label: 'Monday',    open: true, start: '10:00', end: '18:00' },
      { day: 2, label: 'Tuesday',   open: true, start: '10:00', end: '18:00' },
      { day: 3, label: 'Wednesday', open: false },
      { day: 4, label: 'Thursday',  open: true, start: '10:00', end: '18:00' },
      { day: 5, label: 'Friday',    open: true, start: '10:00', end: '20:00' },
      { day: 6, label: 'Saturday',  open: true, start: '09:00', end: '17:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800', caption: 'Skin Fade' },
      { url: 'https://images.unsplash.com/photo-1570288685369-f7305163d0e3?w=800', caption: 'Hair Design' }
    ]
  },
  {
    id: 3,
    first_name: 'Tony', last_name: 'Gambino',
    shop_name: 'Tony\'s Classic Barbershop',
    bio: 'Old school barbershop with modern techniques. Classic cuts, hot towel shaves, and beard sculpting. Family-run for 15 years.',
    city: 'Manhattan', location: '560 Madison Ave, Manhattan, NY',
    lat: 40.7614, lng: -73.9726,
    rating: 4.6, total_reviews: 64, total_bookings: 180,
    years_experience: 15, is_verified: false,
    booked_today: 2, cancellation_hours: 24,
    avatar: 'https://i.pravatar.cc/150?img=52',
    services: [
      { id: 10, name: 'Classic Cut',     category: 'Cuts',  price: 30, duration: 45, desc: 'Traditional scissor cut and style' },
      { id: 11, name: 'Hot Towel Shave', category: 'Beard', price: 45, duration: 45, desc: 'Classic straight razor shave' },
      { id: 12, name: 'Beard Sculpt',    category: 'Beard', price: 35, duration: 40, desc: 'Full beard sculpting and conditioning' },
      { id: 13, name: 'Senior Cut',      category: 'Cuts',  price: 20, duration: 40, desc: 'Discounted cut for seniors 65+' }
    ],
    reviews: [
      { id: 'r6', name: 'Robert S.', rating: 5, comment: 'Old school vibes with amazing skills. Best shave I\'ve had in years!', date: '2024-01-08', reply: null },
      { id: 'r7', name: 'Frank P.',  rating: 4, comment: 'Great neighborhood spot. Tony really knows his craft.', date: '2024-01-03', reply: 'Thank you Frank, always welcome!' }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: false },
      { day: 1, label: 'Monday',    open: true, start: '08:00', end: '17:00' },
      { day: 2, label: 'Tuesday',   open: true, start: '08:00', end: '17:00' },
      { day: 3, label: 'Wednesday', open: true, start: '08:00', end: '17:00' },
      { day: 4, label: 'Thursday',  open: true, start: '08:00', end: '17:00' },
      { day: 5, label: 'Friday',    open: true, start: '08:00', end: '17:00' },
      { day: 6, label: 'Saturday',  open: true, start: '09:00', end: '15:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1534297635766-a262cdcb8ee4?w=800', caption: 'Classic Cut' }
    ]
  },
  {
    id: 4,
    first_name: 'James', last_name: 'Brooks',
    shop_name: 'James The Trim Master',
    bio: 'Queens finest barber. Known for precision fades and creative designs. I work with all hair types. Book early  my schedule fills up fast!',
    city: 'Queens', location: '115-02 Jamaica Ave, Queens, NY',
    lat: 40.7014, lng: -73.7993,
    rating: 4.85, total_reviews: 112, total_bookings: 298,
    years_experience: 8, is_verified: true,
    booked_today: 7, cancellation_hours: 24,
    avatar: 'https://i.pravatar.cc/150?img=15',
    services: [
      { id: 14, name: 'High Fade',  category: 'Cuts',      price: 38, duration: 45, desc: 'High fade with detailed lineups' },
      { id: 15, name: 'Mid Fade',   category: 'Cuts',      price: 35, duration: 40, desc: 'Mid skin fade, very clean finish' },
      { id: 16, name: 'Shape Up',   category: 'Cuts',      price: 20, duration: 25, desc: 'Shape up and lineup only' },
      { id: 17, name: 'Full Groom', category: 'Specialty', price: 65, duration: 75, desc: 'Cut + beard + eyebrow trim' }
    ],
    reviews: [
      { id: 'r8',  name: 'Tyrone W.',  rating: 5, comment: 'James is the GOAT. Every cut is a masterpiece!', date: '2024-01-20', reply: null },
      { id: 'r9',  name: 'Derrick B.', rating: 5, comment: 'Been coming here for 2 years. Never disappoints.', date: '2024-01-15', reply: 'You\'re the real MVP Derrick!' },
      { id: 'r10', name: 'Chris A.',   rating: 4, comment: 'Very skilled barber, would love longer booking availability.', date: '2024-01-09', reply: null }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: false },
      { day: 1, label: 'Monday',    open: true, start: '09:00', end: '19:00' },
      { day: 2, label: 'Tuesday',   open: true, start: '09:00', end: '19:00' },
      { day: 3, label: 'Wednesday', open: true, start: '09:00', end: '19:00' },
      { day: 4, label: 'Thursday',  open: true, start: '09:00', end: '19:00' },
      { day: 5, label: 'Friday',    open: true, start: '09:00', end: '19:00' },
      { day: 6, label: 'Saturday',  open: true, start: '10:00', end: '18:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800', caption: 'High Fade' },
      { url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800', caption: 'Full Groom' }
    ]
  },
  {
    id: 5,
    first_name: 'Alex', last_name: 'Chen',
    shop_name: 'Alex Snip & Style',
    bio: 'Bronx-based barber specializing in textured hair, waves, and modern styles. Affordable prices, great service. English and Spanish spoken.',
    city: 'Bronx', location: '2451 Grand Concourse, Bronx, NY',
    lat: 40.8448, lng: -73.9140,
    rating: 4.45, total_reviews: 43, total_bookings: 95,
    years_experience: 5, is_verified: false,
    booked_today: 1, cancellation_hours: 12,
    avatar: 'https://i.pravatar.cc/150?img=57',
    services: [
      { id: 18, name: 'Wave Cut',   category: 'Cuts',      price: 30, duration: 45, desc: 'Cut and brush wave styling' },
      { id: 19, name: 'Taper Fade', category: 'Cuts',      price: 28, duration: 40, desc: 'Clean taper with styled top' },
      { id: 20, name: 'Kids Cut',   category: 'Kids',      price: 20, duration: 30, desc: 'Kids under 10, all styles' },
      { id: 21, name: 'Curly Top',  category: 'Specialty', price: 35, duration: 50, desc: 'Curly hair cut and definition' }
    ],
    reviews: [
      { id: 'r11', name: 'Miguel R.', rating: 4, comment: 'Good cut, nice atmosphere. Alex is skilled and friendly!', date: '2024-01-14', reply: null },
      { id: 'r12', name: 'Jordan K.', rating: 5, comment: 'Best affordable barber in the Bronx. Highly recommend!', date: '2024-01-07', reply: 'Gracias Jordan!' }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: true,  start: '11:00', end: '16:00' },
      { day: 1, label: 'Monday',    open: true,  start: '10:00', end: '18:00' },
      { day: 2, label: 'Tuesday',   open: true,  start: '10:00', end: '18:00' },
      { day: 3, label: 'Wednesday', open: true,  start: '10:00', end: '18:00' },
      { day: 4, label: 'Thursday',  open: true,  start: '10:00', end: '18:00' },
      { day: 5, label: 'Friday',    open: true,  start: '10:00', end: '20:00' },
      { day: 6, label: 'Saturday',  open: true,  start: '09:00', end: '17:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1634302086687-8a1aa2a5afa6?w=800', caption: 'Wave Cut' }
    ]
  },
  {
    id: 6,
    first_name: 'David', last_name: 'Okafor',
    shop_name: 'D\'s Premium Cuts',
    bio: 'Bringing Lagos-style fades to New York. Specializing in textured hair, cornrows, and modern African American styles.',
    city: 'Brooklyn', location: '445 Nostrand Ave, Brooklyn, NY',
    lat: 40.6706, lng: -73.9496,
    rating: 4.7, total_reviews: 38, total_bookings: 120,
    years_experience: 6, is_verified: false,
    booked_today: 4, cancellation_hours: 24,
    avatar: 'https://i.pravatar.cc/150?img=22',
    services: [
      { id: 22, name: 'Low Fade',   category: 'Cuts',      price: 32, duration: 40, desc: 'Clean low fade with sharp lineup' },
      { id: 23, name: 'Cornrows',   category: 'Specialty', price: 55, duration: 90, desc: 'Braiding and cornrow styles' },
      { id: 24, name: 'Dreadlocks', category: 'Specialty', price: 80, duration: 120, desc: 'Loc maintenance and styling' },
      { id: 25, name: 'Afro Shape', category: 'Cuts',      price: 30, duration: 35, desc: 'Afro shaping and definition' }
    ],
    reviews: [
      { id: 'r13', name: 'Emmanuel O.', rating: 5, comment: 'He really understands textured hair. My fade always looks clean!', date: '2024-01-16', reply: null },
      { id: 'r14', name: 'Kwame A.',    rating: 4, comment: 'Great with natural hair styles. Will be back!', date: '2024-01-10', reply: 'Welcome back anytime Kwame!' }
    ],
    availability: [
      { day: 0, label: 'Sunday',    open: false },
      { day: 1, label: 'Monday',    open: false },
      { day: 2, label: 'Tuesday',   open: true, start: '11:00', end: '19:00' },
      { day: 3, label: 'Wednesday', open: true, start: '11:00', end: '19:00' },
      { day: 4, label: 'Thursday',  open: true, start: '11:00', end: '19:00' },
      { day: 5, label: 'Friday',    open: true, start: '11:00', end: '20:00' },
      { day: 6, label: 'Saturday',  open: true, start: '09:00', end: '18:00' }
    ],
    portfolio: [
      { url: 'https://images.unsplash.com/photo-1590664247844-f938218c4f84?w=800', caption: 'Low Fade' },
      { url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', caption: 'Cornrows' }
    ]
  }
];

let API_BARBERS = [];

function _titleCase(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function _defaultAvailability() {
  return [
    { day: 0, label: 'Sunday', open: false },
    { day: 1, label: 'Monday', open: true, start: '09:00', end: '18:00' },
    { day: 2, label: 'Tuesday', open: true, start: '09:00', end: '18:00' },
    { day: 3, label: 'Wednesday', open: true, start: '09:00', end: '18:00' },
    { day: 4, label: 'Thursday', open: true, start: '09:00', end: '18:00' },
    { day: 5, label: 'Friday', open: true, start: '09:00', end: '18:00' },
    { day: 6, label: 'Saturday', open: true, start: '10:00', end: '16:00' }
  ];
}

function _normalizeApiService(service) {
  return {
    id: parseInt(service.id, 10),
    name: service.name || 'Service',
    desc: service.desc || service.description || '',
    category: _titleCase(service.category || 'cuts'),
    price: (Number(service.price) || 0) / 100,
    duration: Number(service.duration) || 30
  };
}

function _normalizeApiReview(review) {
  const created = review.created_at ? new Date(review.created_at) : new Date();
  const reviewerName = review.reviewer_name || 'Customer';
  const initials = reviewerName.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'CU';
  return {
    id: review.id || `r-${Date.now()}`,
    name: reviewerName,
    initials,
    rating: Number(review.rating) || 5,
    comment: review.comment || '',
    date: Number.isNaN(created.getTime()) ? new Date().toISOString().slice(0, 10) : created.toISOString().slice(0, 10),
    reply: review.reply || null
  };
}

function normalizeApiBarber(row) {
  const existing = BARBERS.find((b) => b.id === parseInt(row.id, 10))
    || API_BARBERS.find((b) => b.id === parseInt(row.id, 10))
    || null;
  const firstName = row.first_name || existing?.first_name || 'Barber';
  const lastName = row.last_name || existing?.last_name || '';
  const servicesRaw = Array.isArray(row.services) ? row.services.filter(Boolean) : (existing?.services || []);
  const services = servicesRaw.length ? servicesRaw.map(_normalizeApiService) : (existing?.services || []);
  const reviewsRaw = Array.isArray(row.reviews) ? row.reviews : (existing?.reviews || []);
  const reviews = reviewsRaw.map((r) => (r.reviewer_name !== undefined ? _normalizeApiReview(r) : r));

  return {
    id: parseInt(row.id, 10),
    first_name: firstName,
    last_name: lastName,
    shop_name: row.shop_name || existing?.shop_name || `${firstName} ${lastName}`.trim(),
    bio: row.bio || existing?.bio || '',
    phone: row.phone || existing?.phone || '',
    city: row.city || existing?.city || '',
    location: row.address || row.location || existing?.location || row.city || '',
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : (existing?.lat ?? null),
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : (existing?.lng ?? null),
    rating: Number(row.rating) || Number(existing?.rating) || 0,
    total_reviews: Number(row.review_count) || Number(existing?.total_reviews) || 0,
    total_bookings: Number(existing?.total_bookings) || 0,
    years_experience: Number(existing?.years_experience) || 0,
    is_verified: Boolean(existing?.is_verified),
    booked_today: Number(existing?.booked_today) || 0,
    cancellation_hours: Number(existing?.cancellation_hours) || 24,
    avatar: row.avatar || existing?.avatar || null,
    services,
    reviews,
    availability: existing?.availability || _defaultAvailability(),
    portfolio: existing?.portfolio || [],
    travel_buffer_minutes: Number(row.travel_buffer_minutes) || 0,
    lunch_break_start: row.lunch_break_start || null,
    lunch_break_end: row.lunch_break_end || null,
    _api: true
  };
}

async function loadApiBarbers(params = {}) {
  if (!window.BH_API) return API_BARBERS;
  try {
    const rows = await window.BH_API.getBarbers(params);
    API_BARBERS = Array.isArray(rows) ? rows.map(normalizeApiBarber) : [];
    return API_BARBERS;
  } catch (error) {
    console.warn('Unable to load API barbers:', error.message);
    return API_BARBERS;
  }
}

async function loadApiBarberById(id) {
  if (!window.BH_API) return null;
  try {
    const row = await window.BH_API.getBarber(id);
    const normalized = normalizeApiBarber(row);
    const idx = API_BARBERS.findIndex((b) => b.id === normalized.id);
    if (idx === -1) API_BARBERS.push(normalized);
    else API_BARBERS[idx] = normalized;
    return normalized;
  } catch (error) {
    console.warn('Unable to load API barber:', error.message);
    return null;
  }
}

//  Helper: get a dynamic (localStorage) barber profile by id 
function getDynamicBarber(id) {
  const profiles = JSON.parse(localStorage.getItem('bh_barber_profiles') || '{}');
  const p = profiles[id];
  if (!p) return null;
  // Merge localStorage service + schedule overrides (same keys barber-dashboard uses)
  const services     = JSON.parse(localStorage.getItem('bh_services_' + id) || 'null') || p.services;
  const availability = JSON.parse(localStorage.getItem('bh_schedule_'  + id) || 'null') || p.availability;
  return { ...p, services, availability };
}

//  Helper: get barber by id (seed data first, then dynamic) 
function getBarber(id) {
  const numId = parseInt(id);
  return API_BARBERS.find((b) => b.id === numId)
    || BARBERS.find((b) => b.id === numId)
    || getDynamicBarber(numId);
}

//  Helper: all barbers (seed + approved dynamic) 
function getAllBarbers() {
  const base = API_BARBERS.length ? API_BARBERS : BARBERS;
  const profiles  = JSON.parse(localStorage.getItem('bh_barber_profiles') || '{}');
  const accounts  = JSON.parse(localStorage.getItem('bh_accounts') || '[]');
  const approvedIds = new Set(
    accounts.filter(a => a.role === 'barber' && a.approved === true).map(a => a.barber_id)
  );
  const dynamic = Object.values(profiles)
    .filter(p => approvedIds.has(p.id))
    .map(p => getDynamicBarber(p.id));
  const knownIds = new Set(base.map((b) => b.id));
  const uniqueDynamic = dynamic.filter((b) => b && !knownIds.has(b.id));
  return [...base, ...uniqueDynamic];
}

const CAL_PREF_KEY_PREFIX = 'bh_calendar_prefs_';
const DEFAULT_CALENDAR_PREFS = {
  buffer_before: 0,
  buffer_after: 10,
  travel_buffer: 0,
  lunch_enabled: true,
  lunch_start: '13:00',
  lunch_end: '14:00'
};

function getBarberCalendarPrefs(barberId) {
  const raw = JSON.parse(localStorage.getItem(`${CAL_PREF_KEY_PREFIX}${barberId}`) || '{}');
  const merged = { ...DEFAULT_CALENDAR_PREFS, ...(raw || {}) };
  return {
    buffer_before: Math.max(0, parseInt(merged.buffer_before, 10) || 0),
    buffer_after: Math.max(0, parseInt(merged.buffer_after, 10) || 0),
    travel_buffer: Math.max(0, parseInt(merged.travel_buffer, 10) || 0),
    lunch_enabled: !!merged.lunch_enabled,
    lunch_start: merged.lunch_start || DEFAULT_CALENDAR_PREFS.lunch_start,
    lunch_end: merged.lunch_end || DEFAULT_CALENDAR_PREFS.lunch_end
  };
}

function setBarberCalendarPrefs(barberId, prefs) {
  const safe = { ...getBarberCalendarPrefs(barberId), ...(prefs || {}) };
  localStorage.setItem(`${CAL_PREF_KEY_PREFIX}${barberId}`, JSON.stringify(safe));
}

//  Helper: get next available day label 
function _pad2(n) { return String(n).padStart(2, '0'); }
function _dateToStr(dateObj) {
  return `${dateObj.getFullYear()}-${_pad2(dateObj.getMonth() + 1)}-${_pad2(dateObj.getDate())}`;
}
function _addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}
function _toMins(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}
function _fromMins(mins) { return `${_pad2(Math.floor(mins / 60))}:${_pad2(mins % 60)}`; }
function _nextHalfHour(mins) { return Math.ceil(mins / 30) * 30; }
function _overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && aEnd > bStart; }
function _labelForOffset(offset) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return null;
}

function getBookingDurationMinutes(booking, barber = null) {
  const explicit = parseInt(booking?.duration_minutes ?? booking?.duration, 10);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (barber?.services?.length && booking?.service_name) {
    const svc = barber.services.find(s => s.name === booking.service_name);
    const svcDur = parseInt(svc?.duration, 10);
    if (Number.isFinite(svcDur) && svcDur > 0) return svcDur;
  }
  return 60;
}

function _isLunchBlocked(barber, slotStart, slotEnd) {
  const prefs = getBarberCalendarPrefs(barber.id);
  if (!prefs.lunch_enabled) return false;
  const lunchStart = _toMins(prefs.lunch_start);
  const lunchEnd = _toMins(prefs.lunch_end);
  if (!Number.isFinite(lunchStart) || !Number.isFinite(lunchEnd) || lunchEnd <= lunchStart) return false;
  return _overlaps(slotStart, slotEnd, lunchStart, lunchEnd);
}

function isSlotAvailable(barber, dateStr, startMins, durationMins, opts = {}) {
  if (!barber || !dateStr || !Number.isFinite(startMins) || !Number.isFinite(durationMins) || durationMins <= 0) return false;

  const dayDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dayDate.getTime())) return false;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (!opts.allowPast && dayDate < today) return false;
  if (!opts.allowPast && _dateToStr(today) === dateStr) {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (startMins < _nextHalfHour(nowMins)) return false;
  }

  const avail = barber.availability?.find(a => a.day === dayDate.getDay());
  if (!avail || !avail.open) return false;
  const openStart = _toMins(avail.start);
  const openEnd = _toMins(avail.end);
  const slotEnd = startMins + durationMins;

  if (startMins < openStart || slotEnd > openEnd) return false;
  if (_isLunchBlocked(barber, startMins, slotEnd)) return false;

  const prefs = getBarberCalendarPrefs(barber.id);
  const allBookings = (typeof Bookings !== 'undefined' && Bookings.getAll) ? Bookings.getAll() : [];
  const sameDayBookings = allBookings.filter(b =>
    b.barber_id === barber.id &&
    b.date === dateStr &&
    b.status !== 'cancelled' &&
    b.id !== opts.excludeBookingId
  );

  for (const booking of sameDayBookings) {
    const bookingStart = _toMins(booking.time);
    const bookingDur = getBookingDurationMinutes(booking, barber);
    const protectedStart = bookingStart - prefs.buffer_before;
    const protectedEnd = bookingStart + bookingDur + prefs.buffer_after + prefs.travel_buffer;
    if (_overlaps(startMins, slotEnd, protectedStart, protectedEnd)) return false;
  }

  return true;
}

function getDaySlots(barber, dateStr, durationMins, opts = {}) {
  if (!barber || !dateStr) return [];
  const dayDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dayDate.getTime())) return [];
  const avail = barber.availability?.find(a => a.day === dayDate.getDay());
  if (!avail || !avail.open) return [];

  const openStart = _toMins(avail.start);
  const openEnd = _toMins(avail.end);
  const slots = [];
  for (let mins = openStart; mins + durationMins <= openEnd; mins += 30) {
    const taken = !isSlotAvailable(barber, dateStr, mins, durationMins, opts);
    slots.push({ time: _fromMins(mins), taken });
  }
  return slots;
}

function getNextOpenSlot(barber, fromDate = new Date()) {
  if (!barber || !Array.isArray(barber.availability)) return null;

  const now = new Date(fromDate);
  const nowDate = new Date(now);
  nowDate.setHours(0, 0, 0, 0);

  const minServiceDuration = barber.services?.length
    ? Math.min(...barber.services.map(s => parseInt(s.duration || 30, 10)))
    : 30;
  const slotDuration = Number.isFinite(minServiceDuration) ? minServiceDuration : 30;

  for (let offset = 0; offset < 14; offset++) {
    const dayDate = _addDays(nowDate, offset);
    const dayKey = _dateToStr(dayDate);
    const dow = dayDate.getDay();
    const avail = barber.availability.find(a => a.day === dow);
    if (!avail || !avail.open) continue;

    let start = _toMins(avail.start);
    const end = _toMins(avail.end);

    if (offset === 0) {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      start = Math.max(start, _nextHalfHour(nowMins));
    }

    for (let mins = start; mins + slotDuration <= end; mins += 30) {
      if (!isSlotAvailable(barber, dayKey, mins, slotDuration, { now })) continue;

      const labelDay = _labelForOffset(offset);
      const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
      const time = _fromMins(mins);
      return {
        date: dayKey,
        time,
        dayOffset: offset,
        dayLabel: labelDay || dayShort,
        display: `${labelDay || dayShort} at ${time}`
      };
    }
  }

  return null;
}

function getNextAvailable(barber) {
  const slot = getNextOpenSlot(barber);
  return slot ? slot.display : 'Check schedule';
}

function _toGoogleCalStamp(dateObj) {
  return dateObj.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function _toICSStamp(dateObj) {
  return `${dateObj.getFullYear()}${_pad2(dateObj.getMonth() + 1)}${_pad2(dateObj.getDate())}T${_pad2(dateObj.getHours())}${_pad2(dateObj.getMinutes())}00`;
}

function getBookingCalendarEvent(booking, barber = null) {
  if (!booking) return null;
  const b = barber || getBarber(booking.barber_id);
  const duration = getBookingDurationMinutes(booking, b);
  const start = new Date(`${booking.date}T${booking.time}:00`);
  const end = new Date(start.getTime() + duration * 60000);
  const title = `${booking.service_name} with ${booking.barber_name || b?.shop_name || 'Barber'}`;
  const location = b?.location || b?.city || '';
  const description = `BarberHub booking #${booking.id}`;
  return { title, start, end, location, description };
}

function buildICSContent(events) {
  const rows = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberHub//Appointments//EN'
  ];

  events.filter(Boolean).forEach((ev, idx) => {
    rows.push('BEGIN:VEVENT');
    rows.push(`UID:barberhub-${Date.now()}-${idx}@barberhub.local`);
    rows.push(`DTSTAMP:${_toGoogleCalStamp(new Date())}`);
    rows.push(`DTSTART:${_toICSStamp(ev.start)}`);
    rows.push(`DTEND:${_toICSStamp(ev.end)}`);
    rows.push(`SUMMARY:${String(ev.title || '').replace(/\n/g, ' ')}`);
    if (ev.location) rows.push(`LOCATION:${String(ev.location).replace(/\n/g, ' ')}`);
    if (ev.description) rows.push(`DESCRIPTION:${String(ev.description).replace(/\n/g, ' ')}`);
    rows.push('END:VEVENT');
  });

  rows.push('END:VCALENDAR');
  return rows.join('\r\n');
}

function downloadICS(filename, events) {
  const text = buildICSContent(events);
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'barberhub-booking.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openBookingInGoogleCalendar(booking, barber = null) {
  const ev = getBookingCalendarEvent(booking, barber);
  if (!ev) return;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${_toGoogleCalStamp(ev.start)}/${_toGoogleCalStamp(ev.end)}`,
    details: ev.description || '',
    location: ev.location || ''
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener');
}

function getGoogleBusinessLink(barber) {
  if (barber?.google_business_url) return barber.google_business_url;
  const name = barber?.shop_name || `${barber?.first_name || ''} ${barber?.last_name || ''}`.trim();
  const query = `${name} ${barber?.location || barber?.city || ''}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

//  Helper: render star HTML 
function starsHTML(rating, size = '0.9rem') {
  let html = `<span class="stars" style="font-size:${size}">`;
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= Math.round(rating) ? 'filled' : ''}"></span>`;
  }
  html += '</span>';
  return html;
}

//  Currency helpers 
function getCurrency() { return localStorage.getItem('bh_currency') || 'USD'; }
function setCurrency(c) { localStorage.setItem('bh_currency', c); location.reload(); }

//  Helper: format price 
function fmtPrice(p) {
  const cur = getCurrency();
  const amt = parseFloat(p);
  if (cur === 'EUR')  return '' + (amt * 0.92).toFixed(0);
  if (cur === 'FCFA') return (amt * 600).toFixed(0) + ' FCFA';
  return '$' + amt.toFixed(0);
}

//  Helper: get barber avatar (localStorage override first) 
function getBarberAvatar(b) {
  return localStorage.getItem('bh_avatar_' + b.id) || b.avatar || null;
}

//  Helper: format duration 
function fmtDur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

//  Helper: status badge 
function statusBadge(status) {
  const map = { pending: 'badge-pending', confirmed: 'badge-confirmed', completed: 'badge-completed', cancelled: 'badge-cancelled' };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

//  Render barber card HTML 
function barberCardHTML(b, page = '') {
  const minPrice    = Math.min(...b.services.map(s => s.price));
  const tags        = b.services.slice(0, 3).map(s => `<span class="bc-tag">${escapeHTML(s.name)}</span>`).join('');
  const nextSlot    = getNextOpenSlot(b);
  const nextAvail   = nextSlot ? nextSlot.display : 'Check schedule';
  const availColor  = nextSlot
    ? (nextSlot.dayOffset === 0 ? 'var(--green)' : nextSlot.dayOffset === 1 ? 'var(--gold)' : 'var(--text-muted)')
    : 'var(--text-muted)';
  const bookedLabel = b.booked_today > 0 ? `<span class="bc-social-proof"> ${b.booked_today} booked today</span>` : '';
  const displayName = escapeHTML(b.shop_name || b.first_name + ' ' + b.last_name);
  const initials    = escapeHTML(b.first_name[0] + b.last_name[0]);

  return `
    <a class="barber-card card fade-in" href="profile.html?id=${b.id}">
      <div class="bc-cover">
        <div class="bc-avatar">${getBarberAvatar(b) ? `<img src="${getBarberAvatar(b)}" alt="${escapeHTML(b.first_name)}" loading="lazy" decoding="async">` : initials}</div>
        ${bookedLabel}
      </div>
      <div class="bc-body">
        <div class="bc-name">
          ${displayName}
          ${b.is_verified ? '<span class="verified-check" title="Verified"></span>' : ''}
        </div>
        <div class="bc-loc"> ${escapeHTML(b.city)}</div>
        <div class="bc-rating">
          ${starsHTML(b.rating)}
          <strong>${b.rating.toFixed(1)}</strong>
          <span>(${b.total_reviews})</span>
        </div>
        <div class="bc-next-avail" style="color:${availColor}"> Next slot: <strong>${escapeHTML(nextAvail)}</strong></div>
        <div class="bc-tags">${tags}</div>
        <div class="bc-footer">
          <span class="bc-price">From <strong>${fmtPrice(minPrice)}</strong></span>
          <span class="btn btn-primary btn-sm">Book Now</span>
        </div>
      </div>
    </a>`;
}



// ============================================================
// Auth  localStorage-based login/signup simulation
// ============================================================

function isProductionRuntime() {
  const host = String(location.hostname || '').toLowerCase();
  const isFile = location.protocol === 'file:';
  const isLocalHost = host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host.startsWith('192.168.');
  return !isFile && !isLocalHost;
}

//  Password hashing (SHA-256 via Web Crypto API) 
async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function isHashed(pw) { return /^[0-9a-f]{64}$/.test(pw); }

//  XSS protection  escape HTML special chars 
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

//  Session timeout  30 minutes of inactivity 
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Pre-computed SHA-256 of 'password'
const _DEMO_PW = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';

const Auth = {
  // Pre-seeded demo accounts (passwords stored as SHA-256 hashes)
  DEMO_ACCOUNTS: [
    { id: 1, email: 'john@demo.com',   password: _DEMO_PW, role: 'customer', first_name: 'John',   last_name: 'Doe',    city: 'New York' },
    { id: 2, email: 'carlos@demo.com', password: _DEMO_PW, role: 'barber',   first_name: 'Carlos', last_name: 'Rivera', city: 'New York', barber_id: 1 },
    { id: 3, email: 'admin@demo.com',  password: _DEMO_PW, role: 'admin',    first_name: 'Admin',  last_name: 'Hub',    city: '' }
  ],

  // Get all stored accounts (demo + registered)
  getAccounts() {
    const stored = JSON.parse(localStorage.getItem('bh_accounts') || '[]');
    return [...this.DEMO_ACCOUNTS, ...stored];
  },

  // Current logged-in user (clears session if timed out)
  getUser() {
    if (isProductionRuntime() && !localStorage.getItem('bh_token')) {
      localStorage.removeItem('bh_user');
      localStorage.removeItem('bh_last_activity');
      return null;
    }
    const u = localStorage.getItem('bh_user');
    if (!u) return null;
    const last = parseInt(localStorage.getItem('bh_last_activity') || '0');
    if (Date.now() - last > SESSION_TIMEOUT) {
      localStorage.removeItem('bh_user');
      localStorage.removeItem('bh_last_activity');
      localStorage.removeItem('bh_token');
      return null;
    }
    return JSON.parse(u);
  },

  isLoggedIn() { return !!this.getUser(); },

  // Login (async  rate-limited, hashes password before comparing)
  async login(email, password) {
    if (isProductionRuntime()) {
      return { ok: false, error: 'Local demo sign-in is disabled in production.' };
    }
    const key      = email.toLowerCase();
    const attempts = JSON.parse(localStorage.getItem('bh_login_attempts') || '{}');
    const rec      = attempts[key] || { count: 0, lockedUntil: 0 };

    // Check lockout
    if (rec.lockedUntil > Date.now()) {
      const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      return { ok: false, error: `Too many failed attempts. Try again in ${mins} minute(s).` };
    }

    const hashed   = await hashPassword(password);
    const accounts = this.getAccounts();
    const account  = accounts.find(a => {
      if (a.email !== key) return false;
      return isHashed(a.password) ? a.password === hashed : a.password === password;
    });

    if (!account) {
      rec.count++;
      const remaining = 3 - rec.count;
      if (rec.count >= 3) { rec.lockedUntil = Date.now() + 15 * 60 * 1000; rec.count = 0; }
      attempts[key] = rec;
      localStorage.setItem('bh_login_attempts', JSON.stringify(attempts));
      const hint = rec.lockedUntil > Date.now() ? ' Account locked for 15 minutes.' : ` ${remaining} attempt(s) remaining.`;
      return { ok: false, error: 'Invalid email or password.' + hint };
    }

    // Success  clear attempts, upgrade legacy plain-text password, set activity
    delete attempts[key];
    localStorage.setItem('bh_login_attempts', JSON.stringify(attempts));
    if (!isHashed(account.password) && account.id > 3) {
      const stored = JSON.parse(localStorage.getItem('bh_accounts') || '[]');
      const idx = stored.findIndex(a => a.id === account.id);
      if (idx !== -1) { stored[idx].password = hashed; localStorage.setItem('bh_accounts', JSON.stringify(stored)); }
    }
    const user = { ...account };
    delete user.password;
    localStorage.setItem('bh_user', JSON.stringify(user));
    localStorage.setItem('bh_last_activity', Date.now().toString());
    return { ok: true, user };
  },

  // Register (async  hashes password before storing)
  async register(data) {
    if (isProductionRuntime()) {
      return { ok: false, error: 'Local demo sign-up is disabled in production.' };
    }
    const accounts = this.getAccounts();
    if (accounts.find(a => a.email === data.email.toLowerCase())) {
      return { ok: false, error: 'Email is already registered.' };
    }
    const stored = JSON.parse(localStorage.getItem('bh_accounts') || '[]');
    const newId  = Date.now();
    const newUser = {
      id: newId,
      email: data.email.toLowerCase(),
      password: await hashPassword(data.password),
      role: data.role,
      first_name: data.first_name,
      last_name:  data.last_name,
      phone:  data.phone  || '',
      city:   data.city   || '',
      barber_id: data.role === 'barber' ? newId : undefined,
      approved:  data.role === 'barber' ? false  : undefined
    };
    stored.push(newUser);
    localStorage.setItem('bh_accounts', JSON.stringify(stored));

    // Create dynamic barber profile in localStorage
    if (data.role === 'barber') {
      const profiles = JSON.parse(localStorage.getItem('bh_barber_profiles') || '{}');
      profiles[newId] = {
        id: newId,
        first_name: data.first_name,
        last_name:  data.last_name,
        shop_name:  `${data.first_name} ${data.last_name}'s Barbershop`,
        bio: '',
        phone:    data.phone || '',
        city:     data.city || '',
        location: data.city || '',
        lat: null, lng: null,
        rating: 0, total_reviews: 0, total_bookings: 0,
        years_experience: 0, is_verified: false,
        booked_today: 0, cancellation_hours: 24,
        avatar: null,
        services: [],
        reviews: [],
        availability: [
          { day: 0, label: 'Sunday',    open: false },
          { day: 1, label: 'Monday',    open: true, start: '09:00', end: '18:00' },
          { day: 2, label: 'Tuesday',   open: true, start: '09:00', end: '18:00' },
          { day: 3, label: 'Wednesday', open: true, start: '09:00', end: '18:00' },
          { day: 4, label: 'Thursday',  open: true, start: '09:00', end: '18:00' },
          { day: 5, label: 'Friday',    open: true, start: '09:00', end: '18:00' },
          { day: 6, label: 'Saturday',  open: false }
        ],
        portfolio: [],
        _dynamic: true
      };
      localStorage.setItem('bh_barber_profiles', JSON.stringify(profiles));
    }

    const user = { ...newUser };
    delete user.password;
    localStorage.setItem('bh_user', JSON.stringify(user));
    return { ok: true, user };
  },

  logout() {
    localStorage.removeItem('bh_user');
    localStorage.removeItem('bh_last_activity');
    localStorage.removeItem('bh_token');
    window.location.href = 'index.html';
  },

  // Update current user data in localStorage
  updateUser(updates) {
    const user = this.getUser();
    if (!user) return;
    const updated = { ...user, ...updates };
    localStorage.setItem('bh_user', JSON.stringify(updated));
    return updated;
  },

  // Require login  redirect if not
  require(role) {
    const user = this.getUser();
    if (!user) { window.location.href = 'login.html'; return null; }
    if (role && user.role !== role && user.role !== 'admin') {
      const map = { customer: 'dashboard.html', barber: 'barber-dashboard.html', admin: 'admin.html' };
      window.location.href = map[user.role] || 'index.html';
      return null;
    }
    return user;
  }
};

//  Bookings (localStorage) 
const Bookings = {
  _key: 'bh_bookings',

  getAll() { return JSON.parse(localStorage.getItem(this._key) || '[]'); },

  getForUser(userId) { return this.getAll().filter(b => b.customer_id === userId); },

  getForBarber(barberId) { return this.getAll().filter(b => b.barber_id === barberId); },

  add(data) {
    const all = this.getAll();
    const booking = {
      id: Date.now(),
      ...data,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    all.push(booking);
    localStorage.setItem(this._key, JSON.stringify(all));
    return booking;
  },

  update(id, updates) {
    const all = this.getAll();
    const idx = all.findIndex(b => b.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      localStorage.setItem(this._key, JSON.stringify(all));
    }
    return all[idx];
  },

  remove(id) {
    const all = this.getAll().filter(b => b.id !== id);
    localStorage.setItem(this._key, JSON.stringify(all));
  }
};

//  Favorites (localStorage) 
const Favorites = {
  _key: 'bh_favorites',

  get(userId) {
    const all = JSON.parse(localStorage.getItem(this._key) || '{}');
    return all[userId] || [];
  },

  toggle(userId, barberId) {
    const all = JSON.parse(localStorage.getItem(this._key) || '{}');
    const favs = all[userId] || [];
    const idx  = favs.indexOf(barberId);
    if (idx === -1) favs.push(barberId);
    else            favs.splice(idx, 1);
    all[userId] = favs;
    localStorage.setItem(this._key, JSON.stringify(all));
    return idx === -1; // true = added
  },

  isFav(userId, barberId) {
    return this.get(userId).includes(barberId);
  }
};

//  Notifications (localStorage) 
const Notifs = {
  _key: 'bh_notifs',

  get(userId) {
    const all = JSON.parse(localStorage.getItem(this._key) || '{}');
    return (all[userId] || []).reverse();
  },

  add(userId, { title, message, type = 'info' }) {
    const all   = JSON.parse(localStorage.getItem(this._key) || '{}');
    const notifs = all[userId] || [];
    notifs.push({ id: Date.now(), title, message, type, is_read: false, created_at: new Date().toISOString() });
    all[userId] = notifs;
    localStorage.setItem(this._key, JSON.stringify(all));
  },

  unreadCount(userId) {
    return this.get(userId).filter(n => !n.is_read).length;
  },

  markAllRead(userId) {
    const all   = JSON.parse(localStorage.getItem(this._key) || '{}');
    const notifs = (all[userId] || []).map(n => ({ ...n, is_read: true }));
    all[userId] = notifs;
    localStorage.setItem(this._key, JSON.stringify(all));
  }
};

//  Reviews 

const ReminderEngine = {
  _key: 'bh_reminders',

  getAll() {
    return JSON.parse(localStorage.getItem(this._key) || '[]');
  },

  saveAll(list) {
    localStorage.setItem(this._key, JSON.stringify(list));
  },

  _toDate(dateStr, timeStr) {
    return new Date(`${dateStr}T${timeStr}:00`);
  },

  scheduleForBooking(booking, user, barberName = '', serviceName = '') {
    if (!booking || !user) return;
    const appt = this._toDate(booking.date, booking.time);
    if (Number.isNaN(appt.getTime())) return;

    const now = Date.now();
    const list = this.getAll();
    const reminders = [
      { type: '24h', offsetMs: 24 * 60 * 60 * 1000, title: 'Appointment Reminder (24h)' },
      { type: '2h',  offsetMs: 2 * 60 * 60 * 1000, title: 'Appointment Reminder (2h)' }
    ];

    reminders.forEach((cfg) => {
      const triggerAt = appt.getTime() - cfg.offsetMs;
      if (triggerAt <= now + 30000) return;

      const exists = list.some(r => r.booking_id === booking.id && r.type === cfg.type);
      if (exists) return;

      list.push({
        id: `${booking.id}-${cfg.type}`,
        booking_id: booking.id,
        user_id: user.id,
        type: cfg.type,
        trigger_at: new Date(triggerAt).toISOString(),
        sent: false,
        title: cfg.title,
        message: `${serviceName || booking.service_name} with ${barberName || booking.barber_name} is on ${booking.date} at ${booking.time}.`
      });
    });

    this.saveAll(list);
  },

  process(userId) {
    if (!userId) return;
    const list = this.getAll();
    const now = Date.now();
    let changed = false;

    list.forEach((r) => {
      if (r.user_id !== userId || r.sent) return;
      if (new Date(r.trigger_at).getTime() > now) return;
      Notifs.add(userId, {
        title: r.title,
        message: r.message,
        type: 'booking'
      });
      r.sent = true;
      changed = true;
    });

    if (changed) this.saveAll(list);
  }
};

const Analytics = {
  _key: 'bh_funnel_events',
  _max: 5000,

  getAll() {
    return JSON.parse(localStorage.getItem(this._key) || '[]');
  },

  saveAll(events) {
    localStorage.setItem(this._key, JSON.stringify(events.slice(-this._max)));
  },

  track(eventName, meta = {}) {
    if (!eventName) return;
    const events = this.getAll();
    events.push({
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      name: eventName,
      page: location.pathname.split('/').pop() || 'index.html',
      at: new Date().toISOString(),
      meta
    });
    this.saveAll(events);
    try {
      if (window.BH_API && typeof window.BH_API.trackEvent === 'function') {
        window.BH_API.trackEvent(eventName, meta).catch(() => {});
      }
    } catch (_) {}
  },

  getWeeklyFunnel() {
    const funnel = ['homepage_view', 'barber_search', 'profile_view', 'booking_start', 'booking_complete'];
    const sinceMs = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const events = this.getAll().filter(e => new Date(e.at).getTime() >= sinceMs);

    const counts = {};
    funnel.forEach(step => { counts[step] = 0; });
    events.forEach((e) => {
      if (counts[e.name] !== undefined) counts[e.name] += 1;
    });

    const conversion = {};
    for (let i = 1; i < funnel.length; i++) {
      const prev = counts[funnel[i - 1]];
      const cur = counts[funnel[i]];
      conversion[funnel[i]] = prev > 0 ? ((cur / prev) * 100) : 0;
    }

    return { counts, conversion };
  }
};

const Monitoring = {
  _errorKey: 'bh_error_events',
  _uptimeKey: 'bh_uptime_checks',
  _maxErrors: 500,
  _maxChecks: 1000,
  _booted: false,

  _read(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  },

  _write(key, rows, max) {
    localStorage.setItem(key, JSON.stringify(rows.slice(-max)));
  },

  logError(errorLike, meta = {}) {
    const rows = this._read(this._errorKey);
    const err = errorLike || {};
    const message = String(err.message || err.reason || 'Unknown error');
    const stack = String(err.stack || '').slice(0, 2000);
    rows.push({
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      at: new Date().toISOString(),
      message,
      stack,
      page: location.pathname.split('/').pop() || 'index.html',
      meta
    });
    this._write(this._errorKey, rows, this._maxErrors);
    try {
      if (window.BH_API && typeof window.BH_API.trackError === 'function') {
        window.BH_API.trackError({
          source: 'client',
          message,
          stack,
          page: location.pathname.split('/').pop() || 'index.html',
          meta,
        }).catch(() => {});
      }
    } catch (_) {}
  },

  getRecentErrors(limit = 30) {
    return this._read(this._errorKey).slice(-limit).reverse();
  },

  async runUptimeCheck(url, timeoutMs = 7000) {
    const started = performance.now();
    let ok = false;
    let status = 0;
    let error = '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      status = response.status;
      ok = response.ok;
    } catch (e) {
      error = String(e?.message || e || 'Request failed');
    } finally {
      clearTimeout(timer);
    }

    const latency = Math.round(performance.now() - started);
    const checks = this._read(this._uptimeKey);
    checks.push({
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      at: new Date().toISOString(),
      url,
      ok,
      status,
      latency,
      error
    });
    this._write(this._uptimeKey, checks, this._maxChecks);
    try {
      const user = Auth.getUser();
      if (user && user.role === 'admin' && window.BH_API && typeof window.BH_API.reportUptime === 'function') {
        window.BH_API.reportUptime({
          target: url,
          ok,
          status_code: status,
          latency_ms: latency,
          error,
        }).catch(() => {});
      }
    } catch (_) {}

    return { ok, status, latency, error };
  },

  async runDefaultUptimeChecks() {
    const targets = ['index.html', 'barbers.html', 'login.html', 'signup.html'];
    const out = [];
    for (const url of targets) {
      // Sequential checks keep rate gentle on small hosting plans.
      // eslint-disable-next-line no-await-in-loop
      out.push(await this.runUptimeCheck(url));
    }
    return out;
  },

  getUptimeSummary(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const checks = this._read(this._uptimeKey)
      .filter(c => new Date(c.at).getTime() >= since);

    const total = checks.length;
    const success = checks.filter(c => c.ok).length;
    const rate = total ? (success / total) * 100 : 0;
    const avgLatency = total
      ? Math.round(checks.reduce((sum, c) => sum + (c.latency || 0), 0) / total)
      : 0;

    return {
      total,
      success,
      failure: total - success,
      rate,
      avgLatency,
      checks: checks.slice().reverse()
    };
  },

  init() {
    if (this._booted) return;
    this._booted = true;

    window.addEventListener('error', (event) => {
      this.logError(event.error || { message: event.message, stack: `${event.filename}:${event.lineno}` }, { source: 'window.error' });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.logError(reason instanceof Error ? reason : { message: String(reason) }, { source: 'unhandledrejection' });
    });
  },

  clear() {
    localStorage.removeItem(this._errorKey);
    localStorage.removeItem(this._uptimeKey);
  }
};

const Reviews = {
  _key: 'bh_reviews',

  get(barberId) { return JSON.parse(localStorage.getItem(this._key) || '{}')[barberId] || []; },

  add(barberId, review) {
    const all    = JSON.parse(localStorage.getItem(this._key) || '{}');
    const reviews = all[barberId] || [];
    reviews.push({ ...review, id: Date.now(), date: new Date().toISOString().split('T')[0] });
    all[barberId] = reviews;
    localStorage.setItem(this._key, JSON.stringify(all));
  }
};



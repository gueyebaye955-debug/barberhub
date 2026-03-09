/* global window, localStorage, location, fetch */
(function attachJelallApi(global) {
  const TOKEN_KEY = 'bh_token';
  const USER_KEY = 'bh_user';
  const LAST_ACTIVITY_KEY = 'bh_last_activity';
  const RAILWAY_API = 'https://jotma.net/api';
  // Use relative /api for all real HTTP servers (production, custom domains, local Express).
  // Only fall back to full Railway URL when opening files directly or via a dev server
  // that is NOT the Express backend (e.g. VSCode Live Server on port 5500).
  const _h = location.hostname;
  const _isProductionRuntime = location.protocol !== 'file:' && _h !== 'localhost' && _h !== '127.0.0.1';
  const _isDevServer = location.protocol === 'file:' ||
    ((_h === 'localhost' || _h === '127.0.0.1') && location.port !== '4000' && location.port !== '80' && location.port !== '443' && location.port !== '');
  const DEFAULT_BASE = _isDevServer ? RAILWAY_API : '/api';

  function getBaseUrl() {
    if (_isProductionRuntime) return DEFAULT_BASE;
    const fromStorage = localStorage.getItem('bh_api_base');
    if (fromStorage) return fromStorage.replace(/\/+$/, '');
    return DEFAULT_BASE;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }

  async function request(path, options = {}) {
    const {
      method = 'GET',
      body,
      auth = false,
      headers = {},
    } = options;

    const reqHeaders = { ...headers };
    if (body !== undefined && body !== null) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (auth) {
      const token = getToken();
      if (token) reqHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: reqHeaders,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object' && payload !== null
        ? (payload.error || payload.message || 'Request failed')
        : String(payload || 'Request failed');
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function normalizeBooking(row) {
    if (!row || typeof row !== 'object') return row;
    const priceRaw = Number(row.price);
    const price = Number.isFinite(priceRaw) ? priceRaw / 100 : row.price;
    const time = typeof row.time === 'string' ? row.time.slice(0, 5) : row.time;
    return { ...row, price, time };
  }

  const api = {
    getBaseUrl,
    getToken,
    setSession,
    clearSession,

    async login(email, password, captchaToken = '') {
      const data = await request('/auth/login', {
        method: 'POST',
        body: { email, password, captcha_token: captchaToken || undefined },
      });
      if (data?.token && data?.user) setSession(data.token, data.user);
      return data;
    },

    async sendRegisterCode(email, captchaToken = '') {
      return { ok: true, demo: false, verification_required: false };
    },

    async register(payload) {
      const data = await request('/auth/register', {
        method: 'POST',
        body: payload,
      });
      if (data?.token && data?.user) setSession(data.token, data.user);
      return data;
    },

    async me() {
      return request('/users/me', { auth: true });
    },

    async updateMe(payload) {
      return request('/users/me', {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
    },

    async getBarbers(params = {}) {
      const query = new URLSearchParams();
      if (params.city) query.set('city', params.city);
      if (params.search) query.set('search', params.search);
      if (params.min_rating) query.set('min_rating', params.min_rating);
      if (params.category) query.set('category', params.category);
      if (params.sort && params.sort !== 'distance' && params.sort !== 'bookings') query.set('sort', params.sort);
      if (params.page) query.set('page', params.page);
      if (params.limit) query.set('limit', params.limit);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return request(`/barbers${suffix}`);
    },

    async getBarber(id) {
      return request(`/barbers/${encodeURIComponent(id)}`);
    },

    async getMyPortfolio() {
      return request('/barbers/me/portfolio', { auth: true });
    },

    async addMyPortfolioPhoto(imageUrl, caption = '') {
      return request('/barbers/me/portfolio', {
        method: 'POST',
        auth: true,
        body: { image_url: imageUrl, caption },
      });
    },

    async uploadMyPortfolioPhoto(imageData, caption = '') {
      return request('/barbers/me/portfolio/upload', {
        method: 'POST',
        auth: true,
        body: { image_data: imageData, caption },
      });
    },

    async updateMyAvatar(imageUrl) {
      return request('/barbers/me/avatar', {
        method: 'POST',
        auth: true,
        body: { image_url: imageUrl },
      });
    },

    async uploadMyAvatar(imageData) {
      return request('/barbers/me/avatar', {
        method: 'POST',
        auth: true,
        body: { image_data: imageData },
      });
    },

    async removeMyAvatar() {
      return request('/barbers/me/avatar', {
        method: 'POST',
        auth: true,
        body: { remove: true },
      });
    },

    async updateMyPortfolioPhoto(photoId, caption) {
      return request(`/barbers/me/portfolio/${encodeURIComponent(photoId)}`, {
        method: 'PATCH',
        auth: true,
        body: { caption },
      });
    },

    async reorderMyPortfolio(photoIds) {
      return request('/barbers/me/portfolio/reorder', {
        method: 'PUT',
        auth: true,
        body: { photo_ids: photoIds },
      });
    },

    async deleteMyPortfolioPhoto(photoId) {
      return request(`/barbers/me/portfolio/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        auth: true,
      });
    },

    async getBookedSlots(barberId, date) {
      const query = new URLSearchParams({ date });
      return request(`/barbers/${encodeURIComponent(barberId)}/booked-slots?${query.toString()}`);
    },

    async addReview(barberId, rating, comment) {
      return request(`/barbers/${encodeURIComponent(barberId)}/reviews`, {
        method: 'POST',
        auth: true,
        body: { rating, comment },
      });
    },

    async getBookings() {
      const rows = await request('/bookings', { auth: true });
      return Array.isArray(rows) ? rows.map(normalizeBooking) : [];
    },

    async createBooking(payload) {
      const data = await request('/bookings', {
        method: 'POST',
        auth: true,
        body: payload,
      });
      if (data?.booking) {
        data.booking = normalizeBooking(data.booking);
      }
      return data;
    },

    async updateBookingStatus(id, status) {
      return request(`/bookings/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        auth: true,
        body: { status },
      });
    },

    async getNotifications() {
      return request('/users/notifications', { auth: true });
    },

    async markNotificationRead(id) {
      return request(`/users/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
        auth: true,
      });
    },

    async getFavorites() {
      return request('/users/favorites', { auth: true });
    },

    async addFavorite(barberId) {
      return request(`/users/favorites/${encodeURIComponent(barberId)}`, {
        method: 'POST',
        auth: true,
      });
    },

    async removeFavorite(barberId) {
      return request(`/users/favorites/${encodeURIComponent(barberId)}`, {
        method: 'DELETE',
        auth: true,
      });
    },

    async getConversations() {
      return request('/messages/conversations', { auth: true });
    },

    async getMessages(userId, page = 1) {
      return request(`/messages/${encodeURIComponent(userId)}?page=${page}`, { auth: true });
    },

    async sendMessage(userId, content) {
      return request(`/messages/${encodeURIComponent(userId)}`, {
        method: 'POST',
        auth: true,
        body: { content },
      });
    },

    async markRead(userId) {
      return request(`/messages/${encodeURIComponent(userId)}/read`, {
        method: 'PATCH',
        auth: true,
      });
    },

    async getCaptchaConfig() {
      return request('/auth/captcha-config');
    },

    async trackEvent(name, meta = {}) {
      return request('/metrics/events', {
        method: 'POST',
        body: { name, meta },
        auth: !!getToken(),
      });
    },

    async trackError(payload = {}) {
      return request('/metrics/errors', {
        method: 'POST',
        body: payload,
        auth: !!getToken(),
      });
    },

    async reportUptime(payload = {}) {
      return request('/metrics/uptime', {
        method: 'POST',
        body: payload,
        auth: true,
      });
    },

    async getFunnel(days = 7) {
      return request(`/metrics/funnel?days=${encodeURIComponent(days)}`, { auth: true });
    },

    async getUptimeSummary(hours = 24) {
      return request(`/metrics/uptime?hours=${encodeURIComponent(hours)}`, { auth: true });
    },

    async getRecentErrors(limit = 20) {
      return request(`/metrics/errors?limit=${encodeURIComponent(limit)}`, { auth: true });
    },

    // Services
    async getMyServices() {
      return request('/barbers/me/services', { auth: true });
    },
    async createService(data) {
      return request('/barbers/me/services', { method: 'POST', body: data, auth: true });
    },
    async updateService(id, data) {
      return request(`/barbers/me/services/${id}`, { method: 'PATCH', body: data, auth: true });
    },
    async uploadServiceImage(id, base64DataUri) {
      return request(`/barbers/me/services/${id}/image`, { method: 'POST', body: { image_data: base64DataUri }, auth: true });
    },
    async deleteService(id) {
      return request(`/barbers/me/services/${id}`, { method: 'DELETE', auth: true });
    },
    async adminGetUsers() {
      return request('/users', { auth: true });
    },
    async adminApproveUser(id, approved) {
      return request(`/users/${id}/approve`, { method: 'PATCH', body: { approved }, auth: true });
    },
    async updateWaveNumber(waveNumber) {
      return request('/barbers/me/wave-number', { method: 'PATCH', auth: true, body: { wave_number: waveNumber } });
    },
    async getBilling(month) {
      const q = month ? `?month=${encodeURIComponent(month)}` : '';
      return request(`/billing${q}`, { auth: true });
    },
    async updateBilling(barberId, data) {
      return request(`/billing/${encodeURIComponent(barberId)}`, { method: 'PATCH', auth: true, body: data });
    },
  };

  global.BH_API = api;
}(window));

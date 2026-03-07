// ============================================================
// Shared navigation renderer
// Call renderNav('index')  pass current page name
// ============================================================

// HTTPS enforcement  redirect HTTP  HTTPS when deployed (skips localhost / file://)
(function () {
  if (location.protocol === 'http:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1' &&
      !location.hostname.startsWith('192.168.')) {
    location.replace('https://' + location.host + location.pathname + location.search + location.hash);
  }
})();

// Content Security Policy  blocks XSS, unknown script sources, data exfiltration
(function () {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
    "font-src 'self' data: https://unpkg.com"
  ].join('; ');
  document.head.prepend(meta);
})();

// Session activity  refresh timestamp on every page load and user interaction
(function () {
  const user = localStorage.getItem('bh_user');
  if (user) {
    localStorage.setItem('bh_last_activity', Date.now().toString());
    const bump = () => localStorage.setItem('bh_last_activity', Date.now().toString());
    document.addEventListener('click',   bump, { passive: true });
    document.addEventListener('keydown', bump, { passive: true });
  }
})();

// Fire pending appointment reminders when a signed-in user returns.
(function () {
  try {
    const user = Auth.getUser();
    if (user && typeof ReminderEngine !== 'undefined') {
      ReminderEngine.process(user.id);
    }
  } catch (_) {}
})();

// Initialize client-side monitoring hooks (errors/unhandled rejections).
(function () {
  try {
    if (typeof Monitoring !== 'undefined') {
      Monitoring.init();
    }
  } catch (_) {}
})();

// Apply theme immediately to avoid flash.
// Default for first-time visitors is dark mode (no class added).
(function () {
  const savedTheme = localStorage.getItem('bh_theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
  }
})();

function renderNav(currentPage) {
  window.__currentNavPage = currentPage;
  const user    = Auth.getUser();
  const unread  = user ? Notifs.unreadCount(user.id) : 0;
  const isLight = localStorage.getItem('bh_theme') === 'light';
  const lang    = getLang();
  const cur     = getCurrency();
  const showNavSearch = true;
  const curLabels = { USD: '$ USD', EUR: '€ EUR', FCFA: 'FCFA' };

  // ── User dropdown / auth buttons ─────────────────────────────────────────
  let userHTML = '';
  if (user) {
    const initials = (user.first_name[0] + user.last_name[0]).toUpperCase();
    const dashLink  = user.role === 'admin'  ? 'admin.html' :
                      user.role === 'barber' ? 'barber-dashboard.html' : 'dashboard.html';
    const bookLink  = user.role === 'barber' ? 'barber-dashboard.html?tab=bookings' : 'dashboard.html?tab=bookings';
    const favLink   = 'dashboard.html?tab=favorites';
    userHTML = `
      <div class="navbar__notif">
        <a href="${dashLink}" class="navbar__icon-btn" title="${t('nav_notifications')}">🔔</a>
        ${unread > 0 ? `<span class="navbar__notif-badge">${unread}</span>` : ''}
      </div>
      <div class="navbar__user">
        <div class="navbar__avatar">${initials}</div>
        <span style="font-size:0.82rem;font-weight:600">${user.first_name}</span>
        <span style="color:var(--text-muted);font-size:0.7rem">▾</span>
        <div class="navbar__dropdown">
          <div style="padding:0.75rem 1rem 0.5rem;border-bottom:1px solid var(--border)">
            <div style="font-size:0.75rem;color:var(--text-muted)">${user.email}</div>
            <span style="background:rgba(233,69,96,0.1);color:var(--primary);border-radius:4px;padding:0.1rem 0.4rem;font-size:0.68rem;font-weight:700">${user.role}</span>
          </div>
          <a href="${dashLink}">🏠 ${t('nav_dashboard')}</a>
          <a href="${bookLink}">📅 ${t('nav_my_bookings')}</a>
          ${user.role === 'customer' ? `<a href="${favLink}">♥ ${t('nav_favorites')}</a>` : ''}
          <hr class="nav-sep">
          <button class="logout" onclick="Auth.logout()">🚪 ${t('nav_logout')}</button>
        </div>
      </div>`;
  } else {
    userHTML = `
      <a href="login.html"  class="btn btn-ghost btn-sm" style="height:36px;padding:0 1rem">${t('nav_login')}</a>
      <a href="signup.html" class="btn btn-primary btn-sm" style="height:36px;padding:0 1rem">${t('nav_signup')}</a>`;
  }

  document.getElementById('navbar').innerHTML = `
    <div class="container">
      <div class="navbar__inner">

        <!-- LEFT: Logo + Nav Links -->
        <div class="navbar__left">
          <a href="index.html" class="navbar__logo">✂ Barber<span>Hub</span></a>
          <nav class="navbar__links">
          </nav>
        </div>

        ${showNavSearch ? `
        <!-- CENTER: Search Bar -->
        <div class="navbar__center">
          <div class="navbar__search-wrap">
            <div class="navbar__search-bar">
              <span class="navbar__search-icon">🔎</span>
              <input class="navbar__search-input" type="text" id="navSearchInput"
                placeholder="${t('nav_search_placeholder')}"
                autocomplete="off"
                oninput="navSearchSuggest(this.value)"
                onkeydown="navSearchKeydown(event)"
                onblur="setTimeout(()=>{const b=document.getElementById('navSuggestions');if(b)b.style.display='none'},400)">
              <div class="navbar__search-divider"></div>
              <select class="navbar__city-select" id="navCitySelect">
                <option value="">${t('hero_search_city')}</option>
                <option>Dakar</option>
                <option>Thiès</option>
                <option>Diourbel</option>
                <option>Saint-Louis</option>
                <option>Louga</option>
                <option>Matam</option>
                <option>Tambacounda</option>
                <option>Kédougou</option>
                <option>Kaffrine</option>
                <option>Kaolack</option>
                <option>Fatick</option>
                <option>Kolda</option>
                <option>Sédhiou</option>
                <option>Ziguinchor</option>
              </select>
            </div>
            <div class="navbar__suggestions" id="navSuggestions" style="display:none"></div>
          </div>
        </div>` : ''}

        <!-- RIGHT: Controls + User -->
        <div class="navbar__right">
          <!-- Currency -->
          <div class="lang-switcher" id="curSwitcher">
            <button class="lang-btn" onclick="toggleCurMenu()" aria-label="Currency" style="border-radius:50px;height:36px">${curLabels[cur]} ▾</button>
            <div class="lang-menu" id="curMenu">
              <button class="lang-opt ${cur==='USD'?'active':''}" onclick="setCurrency('USD')">$ USD</button>
              <button class="lang-opt ${cur==='EUR'?'active':''}" onclick="setCurrency('EUR')">€ EUR</button>
              <button class="lang-opt ${cur==='FCFA'?'active':''}" onclick="setCurrency('FCFA')">FCFA</button>
            </div>
          </div>
          <!-- Language -->
          <div class="lang-switcher" id="langSwitcher">
            <button class="lang-btn" onclick="toggleLangMenu()" aria-label="Language" style="border-radius:50px;height:36px">${lang.toUpperCase()} ▾</button>
            <div class="lang-menu" id="langMenu">
              <button class="lang-opt ${lang==='en'?'active':''}" onclick="setLang('en')">🇺🇸 EN — English</button>
              <button class="lang-opt ${lang==='fr'?'active':''}" onclick="setLang('fr')">🇫🇷 FR — Français</button>
              <button class="lang-opt ${lang==='wo'?'active':''}" onclick="setLang('wo')">🌍 WO — Wolof</button>
            </div>
          </div>
          ${userHTML}
          <!-- Hamburger -->
          <button class="hamburger" onclick="toggleMobileMenu()" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>

      </div>

      <!-- Mobile dropdown menu -->
      <div class="mobile-menu" id="mobileMenu">
        ${showNavSearch ? `
        <!-- Mobile search -->
        <div class="mobile-search-row">
          <input type="text" id="navSearchInputMobile" placeholder="${t('nav_search_mobile_ph')}"
            autocomplete="off"
            oninput="navSearchSuggestMobile(this.value)"
            onkeydown="if(event.key==='Enter')navDoSearchMobile()"
            onblur="setTimeout(()=>{const b=document.getElementById('navSuggestionsMobile');if(b)b.style.display='none'},400)">
        </div>
        <div class="navbar__suggestions" id="navSuggestionsMobile" style="display:none;position:static;margin:0;border-radius:0;box-shadow:none;border-left:none;border-right:none;max-height:260px"></div>` : ''}
        ${user
          ? `<a href="${user.role==='admin'?'admin.html':user.role==='barber'?'barber-dashboard.html':'dashboard.html'}">${t('nav_dashboard')}</a>
             <a href="${user.role==='barber'?'barber-dashboard.html?tab=bookings':'dashboard.html?tab=bookings'}">📅 ${t('nav_my_bookings')}</a>
             <button onclick="Auth.logout()">${t('nav_logout')}</button>`
          : `<a href="login.html">${t('nav_login')}</a><a href="signup.html">${t('nav_signup')}</a>`}
        <div class="mobile-menu__row" style="margin-top:0.25rem">
          <button onclick="setLang('en')" class="mobile-pill ${lang==='en'?'active':''}">EN</button>
          <button onclick="setLang('fr')" class="mobile-pill ${lang==='fr'?'active':''}">FR</button>
          <button onclick="setLang('wo')" class="mobile-pill ${lang==='wo'?'active':''}">WO</button>
          <span class="mobile-divider">|</span>
          <button onclick="setCurrency('USD')" class="mobile-pill ${cur==='USD'?'active':''}">USD</button>
          <button onclick="setCurrency('EUR')" class="mobile-pill ${cur==='EUR'?'active':''}">EUR</button>
          <button onclick="setCurrency('FCFA')" class="mobile-pill ${cur==='FCFA'?'active':''}">FCFA</button>
        </div>
      </div>
    </div>`;

  // Close dropdowns on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeDropdowns(e) {
      if (!e.target.closest('#langSwitcher')) {
        document.getElementById('langMenu')?.classList.remove('open');
      }
      if (!e.target.closest('#curSwitcher')) {
        document.getElementById('curMenu')?.classList.remove('open');
      }
      if (!e.target.closest('#langSwitcher') && !e.target.closest('#curSwitcher')) {
        document.removeEventListener('click', closeDropdowns);
      }
    });
  }, 0);
}

function toggleLangMenu() {
  document.getElementById('langMenu').classList.toggle('open');
  document.getElementById('curMenu')?.classList.remove('open');
}

function toggleCurMenu() {
  document.getElementById('curMenu').classList.toggle('open');
  document.getElementById('langMenu')?.classList.remove('open');
}

function toggleNavSearch() {
  const expanded = document.getElementById('navSearchExpanded');
  if (expanded) {
    const visible = expanded.style.display !== 'none';
    expanded.style.display = visible ? 'none' : 'flex';
    if (!visible) document.getElementById('navSearchInputMobile')?.focus();
  }
}

function collapseNavSearch() {
  const expanded = document.getElementById('navSearchExpanded');
  if (expanded) expanded.style.display = 'none';
}

function navDoSearch() {
  const val  = document.getElementById('navSearchInput')?.value.trim();
  const city = document.getElementById('navCitySelect')?.value.trim();
  if (typeof Analytics !== 'undefined') Analytics.track('barber_search', { source: 'nav_search', query: val, city });
  const params = new URLSearchParams();
  if (val)  params.set('q', val);
  if (city) params.set('city', city);
  window.location.href = 'barbers.html?' + params.toString();
}

function navDoSearchMobile() {
  const val = document.getElementById('navSearchInputMobile')?.value.trim();
  _navHideSuggestions();
  if (val) {
    if (typeof Analytics !== 'undefined') Analytics.track('barber_search', { source: 'nav_search_mobile', query: val });
    window.location.href = 'barbers.html?q=' + encodeURIComponent(val);
  }
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('bh_theme', isLight ? 'light' : 'dark');
  renderNav(window.__currentNavPage || '');
}

function toggleMobileMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ── Search autocomplete ────────────────────────────────────────────────────
const _NAV_CITIES = ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Louga', 'Matam', 'Tambacounda', 'Kédougou', 'Kaffrine', 'Kaolack', 'Fatick', 'Kolda', 'Sédhiou', 'Ziguinchor'];

function _navEsc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _navHighlight(name, q) {
  // q is the raw typed value; we highlight the first q.length chars case-insensitively
  const match = name.slice(0, q.length);
  const rest  = name.slice(q.length);
  return `<span class="navbar__sugg-match">${_navEsc(match)}</span><span class="navbar__sugg-rest">${_navEsc(rest)}</span>`;
}

function navSearchSuggest(val) {
  const box = document.getElementById('navSuggestions');
  if (!box) return;
  const q = val.trim();
  if (q.length < 1) { box.style.display = 'none'; return; }
  const ql = q.toLowerCase();

  // Match cities starting with typed text
  const matchCities = _NAV_CITIES.filter(c => c.toLowerCase().startsWith(ql));

  // Match barbers by shop name or first name (deduplicated)
  const seen = new Set();
  const matchBarbers = [];
  if (typeof getAllBarbers === 'function') {
    for (const b of getAllBarbers()) {
      const shopName = (b.shop_name || '').trim();
      const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      // Try shop name first, then full name, then first name alone
      for (const candidate of [shopName, fullName]) {
        if (!candidate) continue;
        const key = candidate.toLowerCase();
        if (key.startsWith(ql) && !seen.has(key)) {
          seen.add(key);
          matchBarbers.push({
            label: candidate,
            sub: b.city || '',
            id: b.id
          });
          break;
        }
      }
      if (matchBarbers.length >= 8) break;
    }
  }

  if (!matchCities.length && !matchBarbers.length) {
    box.innerHTML = `<div class="navbar__sugg-empty">${tf('nav_no_results_for', { query: `<strong>${_navEsc(q)}</strong>` })}</div>`;
    box.style.display = 'block';
    return;
  }

  let html = '';
  if (matchCities.length) {
    html += `<div class="navbar__sugg-group">📍 ${t('nav_cities_group')}</div>`;
    for (const city of matchCities.slice(0, 5)) {
      html += `<div class="navbar__sugg-item" data-city="${_navEsc(city)}" onclick="navPickCity(this.dataset.city)">
        <span>📍</span>${_navHighlight(city, q)}
      </div>`;
    }
  }
  if (matchBarbers.length) {
    html += `<div class="navbar__sugg-group">✂️ ${t('nav_barbers_group')}</div>`;
    for (const b of matchBarbers) {
      html += `<div class="navbar__sugg-item" data-id="${b.id}" data-label="${_navEsc(b.label)}" onclick="navPickBarber(this.dataset.id,this.dataset.label)">
        <span>✂️</span>${_navHighlight(b.label, q)}
        ${b.sub ? `<span class="navbar__sugg-sub">${_navEsc(b.sub)}</span>` : ''}
      </div>`;
    }
  }

  box.innerHTML = html;
  box.style.display = 'block';
}

function _navHideSuggestions() {
  ['navSuggestions','navSuggestionsMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// Mobile: same logic as desktop but using the mobile suggestions box
function navSearchSuggestMobile(val) {
  const box = document.getElementById('navSuggestionsMobile');
  if (!box) return;
  const q = val.trim();
  if (q.length < 1) { box.style.display = 'none'; return; }
  const ql = q.toLowerCase();
  const matchCities = _NAV_CITIES.filter(c => c.toLowerCase().startsWith(ql));
  const seen = new Set();
  const matchBarbers = [];
  if (typeof getAllBarbers === 'function') {
    for (const b of getAllBarbers()) {
      const shopName = (b.shop_name || '').trim();
      const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      for (const candidate of [shopName, fullName]) {
        if (!candidate) continue;
        const key = candidate.toLowerCase();
        if (key.startsWith(ql) && !seen.has(key)) {
          seen.add(key);
          matchBarbers.push({ label: candidate, sub: b.city || '', id: b.id });
          break;
        }
      }
      if (matchBarbers.length >= 6) break;
    }
  }
  if (!matchCities.length && !matchBarbers.length) {
    box.innerHTML = `<div class="navbar__sugg-empty">${tf('nav_no_results_for', { query: `<strong>${_navEsc(q)}</strong>` })}</div>`;
    box.style.display = 'block'; return;
  }
  let html = '';
  if (matchCities.length) {
    html += `<div class="navbar__sugg-group">📍 ${t('nav_cities_group')}</div>`;
    for (const city of matchCities.slice(0, 4)) {
      html += `<div class="navbar__sugg-item" data-city="${_navEsc(city)}" onclick="navPickCity(this.dataset.city)"><span>📍</span>${_navHighlight(city, q)}</div>`;
    }
  }
  if (matchBarbers.length) {
    html += `<div class="navbar__sugg-group">✂️ ${t('nav_barbers_group')}</div>`;
    for (const b of matchBarbers) {
      html += `<div class="navbar__sugg-item" data-id="${b.id}" data-label="${_navEsc(b.label)}" onclick="navPickBarber(this.dataset.id,this.dataset.label)"><span>✂️</span>${_navHighlight(b.label, q)}${b.sub ? `<span class="navbar__sugg-sub">${_navEsc(b.sub)}</span>` : ''}</div>`;
    }
  }
  box.innerHTML = html;
  box.style.display = 'block';
}

function navPickCity(city) {
  _navHideSuggestions();
  const input = document.getElementById('navSearchInput');
  if (input) { input.value = ''; }
  const sel = document.getElementById('navCitySelect');
  if (sel) {
    for (const opt of sel.options) {
      if (opt.text === city) { sel.value = opt.value || opt.text; break; }
    }
  }
  const params = new URLSearchParams();
  params.set('city', city);
  window.location.href = 'barbers.html?' + params.toString();
}

function navPickBarber(id, name) {
  _navHideSuggestions();
  const input = document.getElementById('navSearchInput');
  if (input) input.value = name;
  window.location.href = 'barbers.html?q=' + encodeURIComponent(name);
}

function navSearchKeydown(e) {
  const box = document.getElementById('navSuggestions');
  if (!box || box.style.display === 'none') {
    if (e.key === 'Enter') navDoSearch();
    return;
  }
  const items = Array.from(box.querySelectorAll('.navbar__sugg-item'));
  if (!items.length) { if (e.key === 'Enter') navDoSearch(); return; }
  const focusedIdx = items.findIndex(el => el.classList.contains('nav-focused'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (focusedIdx >= 0) items[focusedIdx].classList.remove('nav-focused');
    const next = items[(focusedIdx + 1) % items.length];
    next.classList.add('nav-focused');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (focusedIdx >= 0) items[focusedIdx].classList.remove('nav-focused');
    const prev = items[(focusedIdx - 1 + items.length) % items.length];
    prev.classList.add('nav-focused');
  } else if (e.key === 'Enter') {
    if (focusedIdx >= 0) { e.preventDefault(); items[focusedIdx].dispatchEvent(new MouseEvent('click')); }
    else navDoSearch();
  } else if (e.key === 'Escape') {
    box.style.display = 'none';
  }
}

// Load AI chat widget on every page
(function () {
  if (!document.getElementById('bh-chat-widget')) {
    const s = document.createElement('script');
    s.src = 'assets/js/chat-widget.js';
    document.body.appendChild(s);
  }
})();

function renderFooter() {
  document.getElementById('footer').innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__logo"> Barber<span>Hub</span></div>
          <p class="footer__tagline">${t('footer_tagline')}</p>
        </div>
        <div>
          <div class="footer__heading">${t('footer_platform')}</div>
          <ul class="footer__links">
            <li><a href="barbers.html">${t('footer_find_barbers')}</a></li>
            <li><a href="signup.html?role=barber">${t('footer_become_barber')}</a></li>
            <li><a href="signup.html">${t('footer_create_account')}</a></li>
            <li><a href="new-york-barbers.html">${t('footer_nyc_guide')}</a></li>
            <li><a href="brooklyn-barbers.html">${t('footer_brooklyn_barbers')}</a></li>
          </ul>
        </div>
        <div>
          <div class="footer__heading">${t('footer_support')}</div>
          <ul class="footer__links">
            <li><a href="support.html">${t('footer_help')}</a></li>
            <li><a href="support.html#contact">${t('footer_contact')}</a></li>
            <li><a href="privacy.html">${t('footer_privacy')}</a></li>
            <li><a href="terms.html">${t('footer_terms')}</a></li>
            <li><a href="cancellation-policy.html">${t('footer_cancel_policy')}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>${t('footer_rights')}</span>
        <span>${t('footer_made')}</span>
      </div>
    </div>`;
}

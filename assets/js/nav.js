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
  const langLabels = { en: ' EN', fr: ' FR', wo: ' WO' };
  const curLabels  = { USD: '$ USD', EUR: ' EUR', FCFA: 'FCFA' };

  let rightHTML = '';
  if (user) {
    const initials = (user.first_name[0] + user.last_name[0]).toUpperCase();
    const dashLink = user.role === 'admin'  ? 'admin.html' :
                     user.role === 'barber' ? 'barber-dashboard.html' : 'dashboard.html';
    rightHTML = `
      <div class="navbar__user">
        <div class="navbar__avatar">${initials}</div>
        <span style="font-size:0.85rem;font-weight:600">${user.first_name}</span>
        ${unread > 0 ? `<span style="background:var(--primary);color:white;border-radius:50%;width:18px;height:18px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;font-weight:700">${unread}</span>` : ''}
        <span style="color:var(--text-muted);font-size:0.7rem"></span>
        <div class="navbar__dropdown">
          <div style="padding:0.75rem 1rem 0.5rem;font-size:0.8rem;color:var(--text-muted)">${user.email}<br><span style="background:rgba(233,69,96,0.1);color:var(--primary);border-radius:4px;padding:0.1rem 0.4rem;font-size:0.7rem;font-weight:700">${user.role}</span></div>
          <hr class="nav-sep">
          <a href="${dashLink}"> ${t('nav_dashboard')}</a>
          <hr class="nav-sep">
          <button class="logout" onclick="Auth.logout()"> ${t('nav_logout')}</button>
        </div>
      </div>`;
  } else {
    rightHTML = `
      <a href="login.html"  class="btn btn-ghost btn-sm">${t('nav_login')}</a>
      <a href="signup.html" class="btn btn-primary btn-sm">${t('nav_signup')}</a>`;
  }

  document.getElementById('navbar').innerHTML = `
    <div class="container">
      <div class="navbar__inner">
        <a href="index.html" class="navbar__logo"> Barber<span>Hub</span></a>
        <div class="navbar__links">
          <a href="barbers.html">${t('nav_find_barbers')}</a>
          ${!user ? `<a href="signup.html?role=barber">${t('nav_for_barbers')}</a>` : ''}
        </div>
        <div class="navbar__actions">
          <!-- Nav search -->
          <div class="nav-search" id="navSearch">
            <button class="nav-search__btn" onclick="toggleNavSearch()" aria-label="Search"></button>
            <div class="nav-search__bar" id="navSearchBar">
              <input type="text" id="navSearchInput" placeholder="${t('hero_search_q') || 'Search barbers...'}" onkeydown="if(event.key==='Enter')navDoSearch()">
              <button onclick="navDoSearch()" class="btn btn-primary btn-sm">Go</button>
              <button onclick="toggleNavSearch()" class="btn btn-ghost btn-sm" style="padding:0.3rem 0.6rem"></button>
            </div>
          </div>
          <!-- Currency switcher -->
          <div class="lang-switcher" id="curSwitcher">
            <button class="lang-btn" onclick="toggleCurMenu()" aria-label="Currency">
              ${curLabels[cur]} <span style="font-size:0.6rem;opacity:0.6"></span>
            </button>
            <div class="lang-menu" id="curMenu">
              <button class="lang-opt ${cur==='USD'?'active':''}" onclick="setCurrency('USD')">$ USD</button>
              <button class="lang-opt ${cur==='EUR'?'active':''}" onclick="setCurrency('EUR')"> EUR</button>
              <button class="lang-opt ${cur==='FCFA'?'active':''}" onclick="setCurrency('FCFA')"> FCFA</button>
            </div>
          </div>
          <!-- Language switcher dropdown -->
          <div class="lang-switcher" id="langSwitcher">
            <button class="lang-btn" onclick="toggleLangMenu()" aria-label="Language">
              ${langLabels[lang]} <span style="font-size:0.6rem;opacity:0.6"></span>
            </button>
            <div class="lang-menu" id="langMenu">
              <button class="lang-opt ${lang==='en'?'active':''}" onclick="setLang('en')"> EN — English</button>
              <button class="lang-opt ${lang==='fr'?'active':''}" onclick="setLang('fr')"> FR — Français</button>
              <button class="lang-opt ${lang==='wo'?'active':''}" onclick="setLang('wo')"> WO — Wolof</button>
            </div>
          </div>
          <!-- Theme toggle -->
          <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme" aria-label="Toggle theme">
            ${isLight ? '' : ''}
          </button>
          ${rightHTML}
          <button class="hamburger btn-sm" onclick="toggleMobileMenu()" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <!-- Search bar row (expands below nav) -->
      <div class="nav-search__expanded" id="navSearchExpanded" style="display:none">
        <input type="text" id="navSearchInputMobile" placeholder="${t('hero_search_q') || 'Search barbers...'}" onkeydown="if(event.key==='Enter')navDoSearchMobile()">
        <button onclick="navDoSearchMobile()" class="btn btn-primary btn-sm">Go</button>
        <button onclick="collapseNavSearch()" class="btn btn-ghost btn-sm" style="padding:0.3rem 0.6rem"></button>
      </div>
      <div class="mobile-menu" id="mobileMenu">
        <a href="barbers.html">${t('nav_find_barbers')}</a>
        ${user
          ? `<a href="${user.role==='admin'?'admin.html':user.role==='barber'?'barber-dashboard.html':'dashboard.html'}">${t('nav_dashboard')}</a>
             <button onclick="Auth.logout()">${t('nav_logout')}</button>`
          : `<a href="login.html">${t('nav_login')}</a><a href="signup.html">${t('nav_signup')}</a>`}
        <div class="mobile-menu__row">
          <button onclick="setLang('en')" class="mobile-pill ${lang==='en'?'active':''}"> EN</button>
          <button onclick="setLang('fr')" class="mobile-pill ${lang==='fr'?'active':''}"> FR</button>
          <button onclick="setLang('wo')" class="mobile-pill ${lang==='wo'?'active':''}"> WO</button>
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
  const val = document.getElementById('navSearchInput')?.value.trim();
  if (val) {
    if (typeof Analytics !== 'undefined') Analytics.track('barber_search', { source: 'nav_search', query: val });
    window.location.href = 'barbers.html?q=' + encodeURIComponent(val);
  }
}

function navDoSearchMobile() {
  const val = document.getElementById('navSearchInputMobile')?.value.trim();
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
            <li><a href="new-york-barbers.html">NYC Barber Guide</a></li>
            <li><a href="brooklyn-barbers.html">Brooklyn Barbers</a></li>
          </ul>
        </div>
        <div>
          <div class="footer__heading">${t('footer_support')}</div>
          <ul class="footer__links">
            <li><a href="support.html">${t('footer_help')}</a></li>
            <li><a href="support.html#contact">${t('footer_contact')}</a></li>
            <li><a href="privacy.html">${t('footer_privacy')}</a></li>
            <li><a href="terms.html">Terms of Service</a></li>
            <li><a href="cancellation-policy.html">Cancellation Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>${t('footer_rights')}</span>
        <span>${t('footer_made')}</span>
      </div>
    </div>`;
}

(function initHomeInstallPrompt() {
  const bar = document.getElementById('a2hsBar');
  const button = document.getElementById('a2hsBtn');
  const hint = document.getElementById('a2hsHint');
  const closeBtn = document.getElementById('a2hsClose');
  if (!bar || !button || !hint) return;

  const DISMISS_KEY = 'bh_a2hs_dismissed_at';
  const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  }

  function isSafariIOS() {
    const ua = window.navigator.userAgent.toLowerCase();
    if (!isIOS()) return false;
    if (ua.includes('crios') || ua.includes('fxios') || ua.includes('edgios') || ua.includes('opr')) return false;
    return ua.includes('safari');
  }

  function dismissedRecently() {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Number.isFinite(at) && at > 0 && (Date.now() - at) < DISMISS_WINDOW_MS;
    } catch (_) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_) {}
  }

  function showBar(message) {
    if (isStandalone() || dismissedRecently()) return;
    if (message) hint.textContent = message;
    bar.hidden = false;
  }

  function hideBar() {
    bar.hidden = true;
  }

  async function triggerInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) {}
      deferredPrompt = null;
      hideBar();
      return;
    }

    if (isSafariIOS()) {
      showBar('On iPhone: tap Share, then "Add to Home Screen".');
      return;
    }

    showBar('Open browser menu and choose "Install app" or "Add to Home screen".');
  }

  button.addEventListener('click', triggerInstall);
  if (closeBtn) {
    closeBtn.addEventListener('click', function onClose() {
      markDismissed();
      hideBar();
    });
  }

  window.addEventListener('beforeinstallprompt', function onBeforeInstallPrompt(event) {
    event.preventDefault();
    deferredPrompt = event;
    showBar('Install JOTMA for faster booking from your home screen.');
  });

  window.addEventListener('appinstalled', function onInstalled() {
    deferredPrompt = null;
    hideBar();
  });

  if (!isStandalone()) {
    if (isSafariIOS()) {
      showBar('Add JOTMA to your home screen for faster booking.');
    } else {
      showBar('Pin JOTMA to your home screen for one-tap access.');
    }
  }

  if ('serviceWorker' in navigator) {
    const isSecure = window.location.protocol === 'https:'
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1';
    if (isSecure) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function (err) {
        console.warn('Service worker registration failed:', err && err.message ? err.message : err);
      });
    }
  }
}());

(function () {
  if (document.getElementById('bh-chat-widget')) return;

  const FALLBACK_API_BASE = 'https://jotma.net/api';
  const VOICE_MAX_MS = 30000;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Per-language UI labels
  const LABELS = {
    en: {
      title: 'Awa — JOTMA',
      placeholder: 'Type your message...',
      send: 'Send',
      open: 'Chat with Awa',
      mic_start: 'Record voice message',
      mic_stop: 'Stop recording',
      voice_unsupported: 'Voice input is not supported in this browser.',
      voice_no_speech: 'No voice detected. Please try again.',
      voice_limit: 'Voice message reached 30 seconds.',
      voice_denied: 'Microphone access was denied. Please allow it and try again.',
      voice_error: 'Unable to capture voice right now. Please try again.',
    },
    fr: {
      title: 'Awa — JOTMA',
      placeholder: 'Écrivez votre message...',
      send: 'Envoyer',
      open: 'Chat avec Awa',
      mic_start: 'Enregistrer un message vocal',
      mic_stop: "Arrêter l'enregistrement",
      voice_unsupported: "La saisie vocale n'est pas prise en charge dans ce navigateur.",
      voice_no_speech: 'Aucune voix détectée. Réessayez.',
      voice_limit: 'Le message vocal a atteint 30 secondes.',
      voice_denied: 'Accès micro refusé. Autorisez le micro puis réessayez.',
      voice_error: 'Impossible de capter la voix pour le moment. Réessayez.',
    },
    wo: {
      title: 'Awa — JOTMA',
      placeholder: 'Bind sa xbaar...',
      send: 'Yónnee',
      open: 'Chat ak Awa',
      mic_start: 'Taanne message vocal',
      mic_stop: 'Taxawal enregistrement bi',
      voice_unsupported: 'Voice input amul ci navigateur bii.',
      voice_no_speech: 'Benn baat deggu nu ko. Jemaat.',
      voice_limit: 'Message vocal bi matna 30 secondes.',
      voice_denied: 'Microphone bi nanguwul. Maye ndigal te jemaat.',
      voice_error: 'Mennuma jot baat leegi. Jemaat.',
    },
  };

  // Intro messages shown after language is selected
  const INTRO = {
    en: 'Nanga def! 🇸🇳\n\nI\'m Awa, your JOTMA Assistant. I can help you find and book services near you.\n\nTo get started, tell me:\n• What service do you need?\n• When would you like the appointment?\n• Which city are you in?',
    fr: 'Nanga def! 🇸🇳\n\nJe suis Awa, votre assistante JOTMA. Je peux vous aider à trouver et réserver des services près de chez vous.\n\nPour commencer, dites-moi :\n• Quel service vous faut-il ?\n• Quand souhaitez-vous le rendez-vous ?\n• Dans quelle ville êtes-vous ?',
    wo: 'Nanga def! 🇸🇳\n\nMaa ngi Awa, sa jappale JOTMA. Manuma la jàpp prestataire yi te tëral sa rendez-vous.\n\nNu doon ci kanam, xoolal ma :\n• Ana sarwiis bu la neex ?\n• Kañ bëgg nga rendez-vous bi ?\n• Ana dëkk bi nga am ?',
  };

  // GPS state (silent — never asked in chat)
  let _userGPS = null;
  function collectGPS() {
    if (!navigator.geolocation || _userGPS) return;
    navigator.geolocation.getCurrentPosition(
      pos => { _userGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {}, // silent fail — no error shown
      { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  }
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // State
  let _chatLang = null; // null = not yet selected
  let isOpen = false;
  let isBusy = false;
  let recognition = null;
  let isRecording = false;
  let recordStartedAt = 0;
  let recordTimer = null;
  let hardStopTimer = null;
  let finalTranscript = '';
  let liveTranscript = '';
  let shouldSendAfterStop = false;
  let stopReason = '';

  function getLang() { return _chatLang || localStorage.getItem('bh_lang') || 'fr'; }
  function L(key) {
    const lang = getLang();
    return (LABELS[lang] || LABELS.fr)[key] || LABELS.fr[key];
  }

  function resolveChatEndpoints() {
    const endpoints = [];
    function pushEndpoint(base, suffix, toEnd) {
      if (!base) return;
      const clean = String(base).replace(/\/+$/, '');
      const url = clean.endsWith('/chat') || clean.endsWith('/ai') ? clean : `${clean}${suffix}`;
      const idx = endpoints.indexOf(url);
      if (idx >= 0) { if (toEnd) { endpoints.splice(idx, 1); endpoints.push(url); } return; }
      endpoints.push(url);
    }
    function pushBase(base, toEnd) { pushEndpoint(base, '/chat', toEnd); pushEndpoint(base, '/ai', toEnd); }
    const host = location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const isDevServer = location.protocol === 'file:' || (isLocalHost && !['', '80', '443', '4000'].includes(location.port));
    if (isDevServer) pushBase('http://localhost:4000/api');
    pushBase('/api');
    try { if (window.BH_API && typeof window.BH_API.getBaseUrl === 'function') pushBase(window.BH_API.getBaseUrl() || '/api'); } catch (_) {}
    pushBase(FALLBACK_API_BASE, true);
    return endpoints;
  }

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = `
    #bh-chat-widget { position: fixed; right: 1.5rem; bottom: calc(var(--bh-chat-base-bottom, 2.5rem) + env(safe-area-inset-bottom, 0px)); z-index: 9999; font-family: inherit; }
    #bh-chat-btn { background: var(--primary, #e94560); color: #fff; border: none; border-radius: 999px; width: 56px; height: 56px; padding: 0; cursor: pointer; box-shadow: 0 6px 20px rgba(233,69,96,0.45); display: grid; place-items: center; transition: transform 0.2s, box-shadow 0.2s; }
    #bh-chat-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(233,69,96,0.55); }
    #bh-chat-btn svg { width: 24px; height: 24px; }
    #bh-chat-box { display: none; flex-direction: column; width: 340px; max-width: calc(100vw - 2rem); height: 480px; max-height: min(480px, calc(100dvh - 1.5rem)); background: var(--bg-card, #1a1a2e); border: 1px solid var(--border, #2a2a3e); border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.5); overflow: hidden; margin-bottom: 0.75rem; }
    #bh-chat-box.open { display: flex; }
    #bh-chat-header { background: var(--primary, #e94560); color: #fff; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.95rem; flex-shrink: 0; }
    #bh-chat-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 1.2rem; line-height: 1; padding: 0 0.25rem; opacity: 0.85; }
    #bh-chat-header button:hover { opacity: 1; }
    #bh-chat-messages { flex: 1; overflow-y: auto; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .bh-msg { max-width: 85%; padding: 0.65rem 0.9rem; border-radius: 14px; font-size: 0.87rem; line-height: 1.55; word-break: break-word; }
    .bh-msg.user { background: var(--primary, #e94560); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .bh-msg.ai { background: var(--bg-elevated, #252540); color: var(--text, #e0e0e0); align-self: flex-start; border-bottom-left-radius: 4px; }
    .bh-msg.typing { opacity: 0.6; font-style: italic; }
    .bh-lang-btn { background: var(--primary, #e94560); color: #fff; border: none; border-radius: 999px; padding: 0.4rem 0.9rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.15s; white-space: nowrap; }
    .bh-lang-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    .bh-lang-btn:disabled { cursor: default; }
    #bh-chat-input-row { display: flex; align-items: flex-end; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--border, #2a2a3e); flex-shrink: 0; background: var(--bg-card, #1a1a2e); }
    #bh-chat-input { flex: 1; background: var(--bg-elevated, #252540); border: 1px solid var(--border, #2a2a3e); border-radius: 12px; color: var(--text, #e0e0e0); padding: 0.55rem 0.75rem; font-size: 1rem; outline: none; resize: none; height: 38px; max-height: 90px; overflow-y: auto; font-family: inherit; }
    #bh-chat-input:focus { border-color: var(--primary, #e94560); }
    #bh-chat-input:disabled { opacity: 0.5; cursor: not-allowed; }
    #bh-chat-send, #bh-chat-voice { width: 38px; height: 38px; border: none; border-radius: 999px; display: grid; place-items: center; color: #fff; cursor: pointer; flex-shrink: 0; transition: opacity 0.2s, transform 0.2s; padding: 0; }
    #bh-chat-send svg, #bh-chat-voice svg { width: 18px; height: 18px; }
    #bh-chat-send { background: var(--primary, #e94560); }
    #bh-chat-voice { background: #25d366; }
    #bh-chat-send:disabled, #bh-chat-voice:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    #bh-chat-voice.recording { background: #ef4444; animation: bh-voice-pulse 1s ease-in-out infinite; }
    #bh-chat-voice-pill { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fecaca; border-radius: 999px; padding: 0.3rem 0.55rem; font-size: 0.78rem; line-height: 1; white-space: nowrap; }
    #bh-chat-voice-pill[hidden] { display: none; }
    .bh-rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: bh-dot-pulse 0.9s ease-in-out infinite; }
    @keyframes bh-voice-pulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); } 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    @keyframes bh-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @media (max-width: 480px) {
      #bh-chat-widget { --bh-chat-base-bottom: 4.75rem; right: 1rem; }
      #bh-chat-box { width: calc(100vw - 2rem); height: min(420px, calc(100dvh - 7rem)); }
      #bh-chat-btn { width: 52px; height: 52px; }
    }
    /* Keyboard open: pin chat to visual viewport bottom, hide bottom offset */
    body.keyboard-open #bh-chat-widget {
      bottom: env(safe-area-inset-bottom, 0px);
      --bh-chat-base-bottom: 0px;
    }
    body.keyboard-open #bh-chat-box {
      height: calc(var(--bh-visual-height, 100dvh) - 0.5rem);
      max-height: calc(var(--bh-visual-height, 100dvh) - 0.5rem);
      border-radius: 0;
      margin-bottom: 0;
      width: 100vw;
      max-width: 100vw;
      right: 0;
      left: 0;
      position: fixed;
      bottom: env(safe-area-inset-bottom, 0px);
    }
  `;
  document.head.appendChild(style);

  // ---- HTML ----
  const widget = document.createElement('div');
  widget.id = 'bh-chat-widget';
  widget.innerHTML = `
    <div id="bh-chat-box">
      <div id="bh-chat-header">
        <span id="bh-chat-title"></span>
        <button id="bh-chat-close" title="Close">&#x2715;</button>
      </div>
      <div id="bh-chat-messages"></div>
      <div id="bh-chat-input-row">
        <div id="bh-chat-voice-pill" hidden>
          <span class="bh-rec-dot"></span>
          <span id="bh-chat-voice-time">0:00</span>
        </div>
        <textarea id="bh-chat-input" rows="1" maxlength="500"></textarea>
        <button id="bh-chat-send" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
        </button>
        <button id="bh-chat-voice" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>
        </button>
      </div>
    </div>
    <button id="bh-chat-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  `;
  document.body.appendChild(widget);

  const box      = document.getElementById('bh-chat-box');
  const btn      = document.getElementById('bh-chat-btn');
  const closeBtn = document.getElementById('bh-chat-close');
  const messages = document.getElementById('bh-chat-messages');
  const input    = document.getElementById('bh-chat-input');
  const sendBtn  = document.getElementById('bh-chat-send');
  const voiceBtn = document.getElementById('bh-chat-voice');
  const voicePill = document.getElementById('bh-chat-voice-pill');
  const voiceTime = document.getElementById('bh-chat-voice-time');
  const chatHistory = [];

  function updateLabels() {
    document.getElementById('bh-chat-title').textContent = L('title');
    if (!_chatLang) {
      input.placeholder = 'Choisissez une langue / Select a language';
    } else {
      input.placeholder = L('placeholder');
    }
    sendBtn.title = L('send');
    voiceBtn.title = isRecording ? L('mic_stop') : L('mic_start');
    btn.setAttribute('aria-label', L('open'));
  }

  function setActionButtons() {
    // If lang already chosen: mic available for fr/en only
    // If lang not chosen yet: detect from current input — show mic only if clearly fr or en
    const micAvailable = _chatLang
      ? _chatLang !== 'wo'
      : (() => { const d = detectTypingLang(input.value); return d === 'fr' || d === 'en'; })();
    if (isRecording) { sendBtn.style.display = 'none'; voiceBtn.style.display = micAvailable ? 'grid' : 'none'; voiceBtn.disabled = isBusy; return; }
    const hasText = input.value.trim().length > 0;
    sendBtn.style.display = hasText ? 'grid' : 'none';
    voiceBtn.style.display = (hasText || !micAvailable) ? 'none' : 'grid';
    sendBtn.disabled = isBusy || !hasText;
    voiceBtn.disabled = isBusy;
  }

  updateLabels();
  setActionButtons();

  function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function addMessage(text, role) {
    const el = document.createElement('div');
    el.className = `bh-msg ${role}`;
    el.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // ---- Language selection ----
  function showLangGreeting() {
    const el = document.createElement('div');
    el.className = 'bh-msg ai';
    el.innerHTML =
      '<div style="font-size:1rem;font-weight:700;margin-bottom:0.35rem">Nanga def! \uD83C\uDDF8\uD83C\uDDF3<br>Bonjour! \uD83C\uDDEB\uD83C\uDDF7</div>' +
      '<div style="font-size:0.84rem;margin-bottom:0.75rem">C\'est moi Awa, votre assistante JOTMA.<br>Quelle langue préférez-vous ?</div>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
        '<button class="bh-lang-btn" data-lang-select="fr">Français \uD83C\uDDEB\uD83C\uDDF7</button>' +
        '<button class="bh-lang-btn" data-lang-select="wo">Wolof \uD83C\uDDF8\uD83C\uDDF3</button>' +
        '<button class="bh-lang-btn" data-lang-select="en">English \uD83C\uDDFA\uD83C\uDDF8</button>' +
      '</div>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    updateLabels();
    setActionButtons();
  }

  function selectLang(lang) {
    if (!['en', 'fr', 'wo'].includes(lang)) return;
    _chatLang = lang;
    // Dim unselected buttons
    document.querySelectorAll('[data-lang-select]').forEach(b => {
      b.disabled = true;
      b.style.opacity = b.dataset.langSelect === lang ? '1' : '0.35';
    });
    input.disabled = false;
    updateLabels();
    setTimeout(() => {
      addMessage(INTRO[lang], 'ai');
      setActionButtons();
      input.focus();
    }, 250);
  }

  // Click delegation for language buttons
  messages.addEventListener('click', (e) => {
    const btn2 = e.target.closest('[data-lang-select]');
    if (btn2 && !_chatLang) selectLang(btn2.dataset.langSelect);
  });

  // Detect language from typed text
  function detectLangFromText(text) {
    const t = text.toLowerCase().trim();
    if (['fr', 'français', 'francais', 'french'].includes(t)) return 'fr';
    if (['wo', 'wolof', 'wlf'].includes(t)) return 'wo';
    if (['en', 'english', 'anglais'].includes(t)) return 'en';
    return null;
  }

  // Detect language while user is typing (for mic button visibility)
  function detectTypingLang(text) {
    const t = String(text || '').toLowerCase().trim();
    if (t.length < 2) return null;
    // Wolof-specific characters or words → always Wolof (even if mixed with French)
    const wolofMarkers = ['waaw', 'nanga', 'mangi', 'bëgg', 'xam', 'dëkk', 'sama', 'yow', 'nekk', 'wax', 'tekkal', 'japp', 'jërejëf', 'sarwiis', 'kañ', 'déedéet', 'jërejëf'];
    if (wolofMarkers.some(w => t.includes(w)) || t.includes('ë')) return 'wo';
    const words = t.split(/\s+/);
    // French word markers
    const frWords = new Set(['bonjour', 'salut', 'oui', 'non', 'merci', 'avec', 'pour', 'dans', 'sur', 'est', 'les', 'une', 'des', 'du', 'au', 'je', 'tu', 'nous', 'vous', 'voici', 'quel', 'quelle', 'comment', 'cherche', 'veux', 'réserver', 'besoin', 'coiffeur']);
    const enWords = new Set(['hello', 'hi', 'hey', 'the', 'what', 'how', 'when', 'where', 'yes', 'no', 'thanks', 'book', 'need', 'want', 'please', 'available', 'appointment', 'barber', 'looking']);
    let frScore = 0, enScore = 0;
    for (const w of words) {
      if (frWords.has(w)) frScore++;
      if (enWords.has(w)) enScore++;
    }
    if (frScore > enScore && frScore > 0) return 'fr';
    if (enScore > frScore && enScore > 0) return 'en';
    return null;
  }

  function shouldUseLocalFallback(replyText, statusCode) {
    const msg = String(replyText || '').toLowerCase();
    if ([429, 502, 503].includes(Number(statusCode))) return true;
    if (msg.includes('ai service error')) return true;
    if (msg.includes('quota exceeded')) return true;
    if (msg.includes('temporarily busy')) return true;
    if (msg.includes('unavailable')) return true;
    return false;
  }

  function detectProvider(text) {
    const q = String(text || '').toLowerCase();
    const providers = [
      { id: 1, name: 'Carlos Cuts', aliases: ['carlos', 'carlos cuts', 'curlos', 'carols', 'charlos', 'carlo', 'karlos'] },
      { id: 2, name: 'Marcus The Fade King', aliases: ['marcus', 'markus', 'marcu', 'fade king'] },
      { id: 3, name: "Tony's Classic Barbershop", aliases: ['tony', 'toni', 'tonny', 'gambino'] },
    ];
    const exact = providers.find((p) => p.aliases.some((a) => q.includes(a)));
    if (exact) return exact;
    // Fuzzy fallback for user typos
    const fuzzyId = fuzzyProviderMatch(q);
    return fuzzyId ? providers.find(p => p.id === fuzzyId) || null : null;
  }

  function buildLocalFallbackReply(userText, lang) {
    const q = String(userText || '').toLowerCase();
    const provider = detectProvider(q);
    const wantsBooking = /(book|booking|appointment|rendez|rdv|reserve|reserver|tomorrow|demain|today|aujourd|am|pm|\d{1,2}(:\d{2})?)/i.test(q);

    if (provider && wantsBooking) {
      const link = `/book.html?barber=${provider.id}`;
      if (lang === 'en') return `Great choice!\nBook ${provider.name} directly:\nBOOK_LINK:${link}`;
      if (lang === 'wo') return `${provider.name} baax na!\nTekkal ci ay réserver:\nBOOK_LINK:${link}`;
      return `Excellent choix !\nRéservez ${provider.name} directement :\nBOOK_LINK:${link}`;
    }

    if (wantsBooking) {
      if (lang === 'en') return 'I can help you book!\nTell me: service, date/time, and city.\nBOOK_LINK:/barbers.html';
      if (lang === 'wo') return 'Maa ngi fi ngir jappale la!\nWax ma sarwiis bi, date/time, ak dëkk bi.\nBOOK_LINK:/barbers.html';
      return 'Je peux vous aider à réserver !\nDites-moi : service, date/heure, et ville.\nBOOK_LINK:/barbers.html';
    }

    if (lang === 'en') {
      return "I'm here to help you find and book services on JOTMA.\n\nFor more questions:\n+1 313 989 6811\ngueyebaye955@gmail.com";
    }
    if (lang === 'wo') {
      return "Maa ngi fi ngir la japp ci booking JOTMA.\n\nSu laaj yu ci des amee:\n+1 313 989 6811\ngueyebaye955@gmail.com";
    }
    return "Je suis ici pour vous aider a trouver et reserver sur JOTMA.\n\nPour plus de questions:\n+1 313 989 6811\ngueyebaye955@gmail.com";
  }

  // ---- Open / Close ----
  function open() {
    isOpen = true;
    box.classList.add('open');
    btn.style.display = 'none';
    collectGPS(); // silent GPS — no chat prompt
    if (messages.children.length === 0) showLangGreeting();
    input.focus();
    setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 80);
  }

  function close() {
    if (isRecording) endVoiceCapture(false, 'cancel');
    isOpen = false;
    box.classList.remove('open');
    btn.style.display = 'flex';
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  // ---- XHR fallback ----
  function postWithXhr(endpoint, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.timeout = timeoutMs;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => resolve({ status: Number(xhr.status || 0), body: String(xhr.responseText || '') });
      xhr.onerror = () => reject(new Error('XHR network error'));
      xhr.ontimeout = () => reject(new Error('XHR timeout'));
      xhr.send(payload);
    });
  }

  // ---- Provider profiles ----
  const CHAT_PROVIDERS = {
    1: { name: 'Carlos Rivera', shop: 'Carlos Cuts Studio', specialty: 'Fades · Lineups · Barbe', rating: 4.9, city: 'Dakar', avatar: 'https://i.pravatar.cc/150?img=11', lat: 14.6928, lng: -17.4467,
      hours: [null, {o:'09:00',c:'19:00'}, {o:'09:00',c:'19:00'}, {o:'09:00',c:'19:00'}, {o:'09:00',c:'19:00'}, {o:'09:00',c:'19:00'}, {o:'10:00',c:'18:00'}] },
    2: { name: 'Marcus Washington', shop: 'Marcus The Fade King', specialty: 'Skin Fades · Dreads · Lineups', rating: 4.75, city: 'Dakar', avatar: 'https://i.pravatar.cc/150?img=33', lat: 14.6881, lng: -17.4594,
      hours: [null, {o:'10:00',c:'18:00'}, {o:'10:00',c:'18:00'}, null, {o:'10:00',c:'18:00'}, {o:'10:00',c:'20:00'}, {o:'09:00',c:'17:00'}] },
    3: { name: 'Tony Gambino', shop: "Tony's Classic Barbershop", specialty: 'Coupes classiques · Rasage · Barbe', rating: 4.6, city: 'Thiès', avatar: 'https://i.pravatar.cc/150?img=52', lat: 14.7886, lng: -16.9260,
      hours: [null, {o:'09:00',c:'18:00'}, {o:'09:00',c:'18:00'}, {o:'09:00',c:'18:00'}, {o:'09:00',c:'18:00'}, {o:'09:00',c:'18:00'}, {o:'10:00',c:'16:00'}] },
  };

  function getNextAvailable(provider, lang) {
    const now = new Date();
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + d);
      const h = provider.hours[date.getDay()];
      if (!h) continue;
      const [oh, om] = h.o.split(':').map(Number);
      const [ch, cm] = h.c.split(':').map(Number);
      const openMin = oh * 60 + om, closeMin = ch * 60 + cm;
      let slotMin;
      if (d === 0) {
        const curMin = now.getHours() * 60 + now.getMinutes() + 30;
        if (curMin >= closeMin) continue;
        slotMin = Math.max(curMin, openMin);
        // round up to next 30min
        slotMin = Math.ceil(slotMin / 30) * 30;
        if (slotMin >= closeMin) continue;
      } else {
        slotMin = openMin;
      }
      const label = d === 0 ? (lang === 'wo' ? 'Tey' : lang === 'en' ? 'Today' : "Auj.")
                  : d === 1 ? (lang === 'wo' ? 'Suba' : lang === 'en' ? 'Tomorrow' : 'Demain')
                  : date.toLocaleDateString(lang === 'en' ? 'en' : 'fr', { weekday: 'short' });
      const hh = Math.floor(slotMin / 60), mm = slotMin % 60;
      return label + ' ' + String(hh).padStart(2,'0') + 'h' + (mm ? String(mm).padStart(2,'0') : '00');
    }
    return null;
  }

  // Keywords that map reply text → provider ID (case-insensitive)
  const PROVIDER_KEYWORDS = [
    { id: 1, words: ['carlos', 'carlos cuts', 'carlos rivera', 'curlos', 'carols', 'charlos', 'carlo', 'karlos'] },
    { id: 2, words: ['marcus', 'marcus washington', 'fade king', 'markus', 'marcu', 'marcuse'] },
    { id: 3, words: ['tony', 'tony gambino', 'classic barbershop', 'toni', 'tonny', 'gambino'] },
  ];

  // Levenshtein distance for fuzzy single-word matching
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function fuzzyProviderMatch(text) {
    const words = String(text || '').toLowerCase().split(/\s+/);
    const targets = [
      { id: 1, keys: ['carlos', 'curlos', 'carols', 'carlo'] },
      { id: 2, keys: ['marcus', 'markus'] },
      { id: 3, keys: ['tony', 'gambino'] },
    ];
    for (const word of words) {
      if (word.length < 4) continue;
      for (const t of targets) {
        if (t.keys.some(k => levenshtein(word, k) <= 2)) return t.id;
      }
    }
    return null;
  }

  function getLastProviderFromHistory() {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const entry = chatHistory[i];
      if (!entry || !entry.text) continue;
      const lower = String(entry.text).toLowerCase();
      for (const p of PROVIDER_KEYWORDS) {
        if (p.words.some(w => lower.includes(w))) return p.id;
      }
    }
    return null;
  }

  function extractProfileCard(reply, tagOnly = false) {
    const text = String(reply || '');
    // Check explicit tag first (always respected)
    const tagMatch = text.match(/PROFILE_CARD:(\d+)/);
    if (tagMatch) {
      return { cleanReply: text.replace(/\n?PROFILE_CARD:\d+/g, '').trim(), profileId: Number(tagMatch[1]) };
    }
    // Strip any malformed PROFILE_CARD tags (e.g. PROFILE_CARD:Carlos Cuts Studio) so they never show as raw text
    const stripped = text.replace(/\n?PROFILE_CARD:[^\n]*/g, '').trim();
    // Only scan reply for provider names if user explicitly named one in their message
    if (tagOnly) return { cleanReply: stripped, profileId: null };
    const lower = stripped.toLowerCase();
    for (const p of PROVIDER_KEYWORDS) {
      if (p.words.some(w => lower.includes(w))) {
        return { cleanReply: stripped, profileId: p.id };
      }
    }
    const fuzzyId = fuzzyProviderMatch(stripped);
    if (fuzzyId) return { cleanReply: stripped, profileId: fuzzyId };
    return { cleanReply: stripped, profileId: null };
  }

  function appendProfileCard(profileId, lang) {
    try {
      const p = CHAT_PROVIDERS[profileId];
      if (!p) return;
      const profileUrl = '/barber/' + profileId;
      const bookUrl = '/book.html?barber=' + profileId;
      const profileLabel = lang === 'en' ? 'See profile' : lang === 'wo' ? 'Xool profil' : 'Voir le profil';
      const bookLabel = lang === 'en' ? 'Book appointment' : lang === 'wo' ? 'Tekkal' : 'Reserver';

      // wrapper
      const card = document.createElement('div');
      card.className = 'bh-msg ai';
      card.style.padding = '0';
      card.style.background = 'transparent';
      card.style.maxWidth = '100%';

      // inner box
      const box = document.createElement('div');
      box.style.cssText = 'background:#252540;border:1px solid #2a2a3e;border-radius:14px;border-bottom-left-radius:4px;overflow:hidden;';

      // top row: avatar + info
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem;';

      const img = document.createElement('img');
      img.src = p.avatar;
      img.alt = p.name;
      img.style.cssText = 'width:54px;height:54px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #e94560;';
      img.onerror = function() { this.style.display = 'none'; };

      const info = document.createElement('div');
      info.style.minWidth = '0';

      const shopEl = document.createElement('div');
      shopEl.style.cssText = 'font-weight:700;font-size:0.9rem;color:#e0e0e0;';
      shopEl.textContent = p.shop;

      const specEl = document.createElement('div');
      specEl.style.cssText = 'font-size:0.78rem;color:#888;margin-top:2px;';
      specEl.textContent = p.specialty;

      const ratingEl = document.createElement('div');
      ratingEl.style.cssText = 'font-size:0.78rem;margin-top:3px;color:#888;';
      ratingEl.textContent = '\u2605 ' + p.rating + ' \u00b7 ' + p.city;

      const nextSlot = getNextAvailable(p, lang);
      const availEl = document.createElement('div');
      availEl.style.cssText = 'font-size:0.75rem;margin-top:3px;color:#4ade80;font-weight:600;';
      availEl.textContent = nextSlot
        ? '\uD83D\uDDD3 ' + (lang === 'en' ? 'Next: ' : lang === 'wo' ? 'Ci kanam: ' : 'Prochaine dispo : ') + nextSlot
        : (lang === 'en' ? 'No availability this week' : lang === 'wo' ? 'Amul disponibilité' : 'Pas de dispo cette semaine');

      info.appendChild(shopEl);
      info.appendChild(specEl);
      info.appendChild(ratingEl);
      info.appendChild(availEl);
      row.appendChild(img);
      row.appendChild(info);
      box.appendChild(row);

      // profile button (red)
      const profBtn = document.createElement('a');
      profBtn.href = profileUrl;
      profBtn.target = '_blank';
      profBtn.rel = 'noopener';
      profBtn.style.cssText = 'display:block;background:#e94560;color:#fff;text-align:center;text-decoration:none;padding:0.65rem 1rem;font-size:0.88rem;font-weight:700;';
      profBtn.textContent = '\uD83D\uDC64 ' + profileLabel;
      box.appendChild(profBtn);

      // book link (subtle)
      const bookBtn = document.createElement('a');
      bookBtn.href = bookUrl;
      bookBtn.target = '_blank';
      bookBtn.rel = 'noopener';
      bookBtn.style.cssText = 'display:block;text-align:center;text-decoration:none;padding:0.45rem 1rem;font-size:0.78rem;color:#888;border-top:1px solid #2a2a3e;';
      bookBtn.textContent = '\uD83D\uDCC5 ' + bookLabel;
      box.appendChild(bookBtn);

      card.appendChild(box);
      messages.appendChild(card);
      messages.scrollTop = messages.scrollHeight;
    } catch(e) { console.error('appendProfileCard error:', e); }
  }

  // ---- Multi-provider display ----
  function extractShowProviders(reply) {
    const match = String(reply || '').match(/SHOW_PROVIDERS:[^\n]*/);
    if (!match) return { cleanReply: reply, showProviders: false };
    return { cleanReply: reply.replace(/\n?SHOW_PROVIDERS:[^\n]*/g, '').trim(), showProviders: true };
  }

  function appendMultipleCards(lang) {
    const providers = Object.values(CHAT_PROVIDERS);
    if (_userGPS) {
      providers.sort((a, b) => {
        const dA = haversineKm(_userGPS.lat, _userGPS.lng, a.lat, a.lng);
        const dB = haversineKm(_userGPS.lat, _userGPS.lng, b.lat, b.lng);
        return Math.abs(dA - dB) < 5 ? b.rating - a.rating : dA - dB;
      });
    } else {
      providers.sort((a, b) => b.rating - a.rating);
    }
    providers.slice(0, 5).forEach(p => appendProfileCard(p.id, lang));
  }

  // ---- Book link helpers ----
  function extractBookLink(reply) {
    const text = String(reply || '');
    // 1. Explicit tag: BOOK_LINK:/path
    const tagMatch = text.match(/BOOK_LINK:(\/\S+)/);
    if (tagMatch) {
      return { cleanReply: text.replace(/\n?BOOK_LINK:\/\S+/g, '').trim(), bookUrl: tagMatch[1] };
    }
    // 2. Raw URL the AI printed (e.g. https://jotma.net/book.html?barber=1)
    const urlMatch = text.match(/https?:\/\/\S*\/book\.html\?barber=(\d+)/);
    if (urlMatch) {
      const bookUrl = `/book.html?barber=${urlMatch[1]}`;
      const cleanReply = text.replace(/https?:\/\/\S*\/book\.html\?barber=\d+/g, '').replace(/\s{2,}/g, ' ').trim();
      return { cleanReply, bookUrl };
    }
    // 3. Raw /barbers.html mention
    const browsMatch = text.match(/https?:\/\/\S*\/barbers\.html/);
    if (browsMatch) {
      const cleanReply = text.replace(/https?:\/\/\S*\/barbers\.html/g, '').trim();
      return { cleanReply, bookUrl: '/barbers.html' };
    }
    return { cleanReply: text, bookUrl: null };
  }

  function appendBookCard(bookUrl, lang) {
    const labels = {
      en: { btn: 'Book Now →', sub: 'Tap to open the booking page' },
      fr: { btn: 'Réserver maintenant →', sub: 'Appuyez pour ouvrir la page de réservation' },
      wo: { btn: 'Tekkal leegi →', sub: 'Seet page réservation bi' },
    };
    const lb = labels[lang] || labels.fr;
    const card = document.createElement('div');
    card.className = 'bh-msg ai';
    card.style.cssText = 'padding:0;overflow:hidden;background:transparent;';
    card.innerHTML = `<a href="${escapeHTML(bookUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:0.65rem;background:var(--primary,#e94560);color:#fff;text-decoration:none;padding:0.65rem 0.9rem;border-radius:14px;border-bottom-left-radius:4px;font-size:0.87rem;font-weight:700;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <div><div>${escapeHTML(lb.btn)}</div><div style="font-size:0.75rem;opacity:0.85;font-weight:400">${escapeHTML(lb.sub)}</div></div>
    </a>`;
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  // ---- Send ----
  async function send(overrideText) {
    let text = String(overrideText !== undefined ? overrideText : input.value).trim();
    if (text.length > 500) text = text.slice(0, 500).trim();
    if (!text || isBusy) return;

    // If language not yet selected, try to detect from typed text; otherwise default to fr
    if (!_chatLang) {
      const detected = detectLangFromText(text);
      if (detected) { input.value = ''; selectLang(detected); return; }
      // User skipped language picker — default to French and continue normally
      _chatLang = 'fr';
      updateLabels();
      setActionButtons();
    }

    isBusy = true;
    sendBtn.disabled = true;
    voiceBtn.disabled = true;
    input.value = '';
    input.style.height = '38px';
    setActionButtons();

    addMessage(text, 'user');
    const typing = addMessage('...', 'ai typing');

    try {
      const endpoints = resolveChatEndpoints();
      let res = null;
      let raw = '';
      let lastNetworkError = null;
      const attempts = [];
      const payload = JSON.stringify({ message: text, history: chatHistory, lang: _chatLang, gps: _userGPS });

      for (const endpoint of endpoints) {
        try {
          const candidateRes = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, cache: 'no-store' });
          const candidateRaw = await candidateRes.text();
          attempts.push({ endpoint, status: candidateRes.status });
          if (!candidateRes.ok && endpoint !== endpoints[endpoints.length - 1]) continue;
          res = candidateRes; raw = candidateRaw; break;
        } catch (err) {
          attempts.push({ endpoint, fetch_error: true });
          lastNetworkError = err || lastNetworkError;
          try {
            const xhrResult = await postWithXhr(endpoint, payload, 15000);
            attempts.push({ endpoint, status: xhrResult.status, via: 'xhr' });
            if (xhrResult.status === 0 && endpoint !== endpoints[endpoints.length - 1]) continue;
            res = { ok: xhrResult.status >= 200 && xhrResult.status < 300, status: xhrResult.status };
            raw = xhrResult.body;
            if (!res.ok && endpoint !== endpoints[endpoints.length - 1]) continue;
            break;
          } catch (xhrErr) {
            attempts.push({ endpoint, xhr_error: true });
            lastNetworkError = xhrErr || lastNetworkError;
          }
        }
      }

      if (!res) throw lastNetworkError || new Error('Unable to reach chat API.');
      if (!res.ok && attempts.length > 1) console.warn('Awa chat attempts:', attempts);

      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

      const fallbackError = res.status === 404
        ? 'Chat route not found. Please redeploy the backend.'
        : (res.status === 503
          ? 'AI service is busy right now. Please try again in a moment.'
          : `Server error ${res.status}. Please try again.`);

      const rawReply = data.reply || data.error || (res.ok ? 'Something went wrong.' : fallbackError);
      const reply = shouldUseLocalFallback(rawReply, res.status)
        ? buildLocalFallbackReply(text, _chatLang)
        : rawReply;
      const { cleanReply: r0, showProviders } = extractShowProviders(reply);
      // Only show card if user explicitly named a provider
      const userNamedProvider = !!detectProvider(text);
      const { cleanReply: r1, profileId: pidFromReply } = extractProfileCard(r0, !userNamedProvider);
      const { cleanReply, bookUrl } = extractBookLink(r1);
      const profileId = pidFromReply;
      typing.className = 'bh-msg ai';
      typing.innerHTML = escapeHTML(cleanReply).replace(/\n/g, '<br>');
      if (showProviders && !profileId) appendMultipleCards(_chatLang);
      else if (profileId) appendProfileCard(profileId, _chatLang);
      if (bookUrl) appendBookCard(bookUrl, _chatLang);

      if (reply) {
        chatHistory.push({ role: 'user', text });
        chatHistory.push({ role: 'model', text: reply });
        if (chatHistory.length > 12) chatHistory.splice(0, 2);
      }
    } catch (_) {
      typing.className = 'bh-msg ai';
      let msg = buildLocalFallbackReply(text, _chatLang || 'fr');
      try {
        const h = await fetch('/api/health', { cache: 'no-store' });
        if (!h || !h.ok) msg = buildLocalFallbackReply(text, _chatLang || 'fr');
      } catch (_2) {}
      const { cleanReply: cleanMsg, bookUrl: fallbackUrl } = extractBookLink(msg);
      typing.innerHTML = escapeHTML(cleanMsg).replace(/\n/g, '<br>');
      if (fallbackUrl) appendBookCard(fallbackUrl, _chatLang || 'fr');
    }

    messages.scrollTop = messages.scrollHeight;
    isBusy = false;
    sendBtn.disabled = false;
    voiceBtn.disabled = false;
    setActionButtons();
    input.focus();
  }

  // ---- Voice ----
  function getVoiceLang() { const l = getLang(); if (l === 'fr') return 'fr-FR'; if (l === 'wo') return 'fr-SN'; return 'en-US'; }
  function formatVoiceTime(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function clearVoiceTimers() { if (recordTimer) { clearInterval(recordTimer); recordTimer = null; } if (hardStopTimer) { clearTimeout(hardStopTimer); hardStopTimer = null; } }
  function setRecordingUi(active) { voiceBtn.classList.toggle('recording', !!active); voicePill.hidden = !active; updateLabels(); setActionButtons(); }
  function resetVoiceBuffers() { finalTranscript = ''; liveTranscript = ''; shouldSendAfterStop = false; stopReason = ''; }

  function ensureRecognition() {
    if (!SpeechRecognitionCtor) return false;
    if (recognition) return true;
    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let fp = '', ip = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = String(event.results[i][0]?.transcript || '').trim();
        if (!piece) continue;
        if (event.results[i].isFinal) fp += (fp ? ' ' : '') + piece;
        else ip += (ip ? ' ' : '') + piece;
      }
      if (fp) finalTranscript = (finalTranscript + ' ' + fp).trim();
      liveTranscript = ip;
      const combined = (finalTranscript + ' ' + liveTranscript).trim().slice(0, 500);
      if (combined) { input.value = combined; input.style.height = '38px'; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; }
    };
    recognition.onerror = (event) => {
      const err = event?.error || '';
      if (err === 'not-allowed' || err === 'service-not-allowed') addMessage(L('voice_denied'), 'ai');
      else if (err && err !== 'aborted' && err !== 'no-speech') addMessage(L('voice_error'), 'ai');
      shouldSendAfterStop = false;
    };
    recognition.onend = () => {
      if (isRecording) { isRecording = false; clearVoiceTimers(); setRecordingUi(false); }
      const transcript = (finalTranscript + ' ' + liveTranscript).trim();
      const ss = shouldSendAfterStop, reason = stopReason;
      resetVoiceBuffers();
      if (!ss) { setActionButtons(); return; }
      if (reason === 'limit') addMessage(L('voice_limit'), 'ai');
      if (transcript) send(transcript);
      else { addMessage(L('voice_no_speech'), 'ai'); setActionButtons(); }
    };
    return true;
  }

  function endVoiceCapture(shouldSend, reason) {
    if (!isRecording || !recognition) { shouldSendAfterStop = false; stopReason = ''; setActionButtons(); return; }
    shouldSendAfterStop = !!shouldSend; stopReason = reason || 'manual';
    isRecording = false; clearVoiceTimers(); setRecordingUi(false);
    try { recognition.stop(); } catch (_) {
      const transcript = (finalTranscript + ' ' + liveTranscript).trim(), sa = shouldSendAfterStop, lr = stopReason;
      resetVoiceBuffers();
      if (sa) { if (lr === 'limit') addMessage(L('voice_limit'), 'ai'); if (transcript) send(transcript); else addMessage(L('voice_no_speech'), 'ai'); }
      setActionButtons();
    }
  }

  function startVoiceCapture() {
    if (isBusy || !_chatLang) return;
    if (!ensureRecognition()) { addMessage(L('voice_unsupported'), 'ai'); return; }
    try {
      recognition.lang = getVoiceLang(); input.value = ''; input.style.height = '38px';
      resetVoiceBuffers(); recognition.start();
      isRecording = true; recordStartedAt = Date.now(); voiceTime.textContent = '0:00';
      recordTimer = setInterval(() => { voiceTime.textContent = formatVoiceTime(Date.now() - recordStartedAt); }, 250);
      hardStopTimer = setTimeout(() => endVoiceCapture(true, 'limit'), VOICE_MAX_MS);
      setRecordingUi(true);
    } catch (_) { addMessage(L('voice_error'), 'ai'); setActionButtons(); }
  }

  sendBtn.addEventListener('click', () => send());
  voiceBtn.addEventListener('click', () => { if (isBusy) return; if (isRecording) endVoiceCapture(true, 'manual'); else startVoiceCapture(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => {
    if (!isRecording) { input.style.height = '38px'; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; }
    setActionButtons();
  });

  window.addEventListener('bh-lang-change', () => { updateLabels(); setActionButtons(); });
})();

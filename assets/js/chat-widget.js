(function () {
  // Only init once
  if (document.getElementById('bh-chat-widget')) return;

  const LABELS = {
    en: { title: 'JOTMA Assistant', placeholder: 'Ask me anything...', send: 'Send', open: 'Chat with AI', welcome: 'Hi! I\'m the JOTMA Assistant. Ask me anything about bookings, barbers, or services.' },
    fr: { title: 'Assistant JOTMA', placeholder: 'Posez votre question...', send: 'Envoyer', open: 'Chat IA', welcome: 'Bonjour! Je suis l\'assistant JOTMA. Posez-moi vos questions sur les réservations, les prestataires ou les services.' },
    wo: { title: 'Jëfandikukat JOTMA', placeholder: 'Laaj sa laaj...', send: 'Yónnee', open: 'AI Chat', welcome: 'Asalaamalekum! Maa ngi JOTMA Assistant. Laajal ma ci réservation, prestataire, walla sarwiis yi.' },
  };

  function getLang() {
    return localStorage.getItem('bh_lang') || 'en';
  }
  function L(key) {
    const lang = getLang();
    return (LABELS[lang] || LABELS.en)[key] || LABELS.en[key];
  }

  // ---- Inject styles ----
  const style = document.createElement('style');
  style.textContent = `
    #bh-chat-widget { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999; font-family: inherit; }
    #bh-chat-btn { background: var(--primary, #e94560); color: #fff; border: none; border-radius: 50px; padding: 0.75rem 1.25rem; cursor: pointer; font-size: 0.9rem; font-weight: 600; box-shadow: 0 4px 16px rgba(233,69,96,0.4); display: flex; align-items: center; gap: 0.5rem; transition: transform 0.2s, box-shadow 0.2s; }
    #bh-chat-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(233,69,96,0.5); }
    #bh-chat-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
    #bh-chat-box { display: none; flex-direction: column; width: 340px; max-width: calc(100vw - 2rem); height: 460px; background: var(--bg-card, #1a1a2e); border: 1px solid var(--border, #2a2a3e); border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.5); overflow: hidden; margin-bottom: 0.75rem; }
    #bh-chat-box.open { display: flex; }
    #bh-chat-header { background: var(--primary, #e94560); color: #fff; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.95rem; flex-shrink: 0; }
    #bh-chat-header button { background: none; border: none; color: #fff; cursor: pointer; font-size: 1.2rem; line-height: 1; padding: 0 0.25rem; opacity: 0.85; }
    #bh-chat-header button:hover { opacity: 1; }
    #bh-chat-messages { flex: 1; overflow-y: auto; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .bh-msg { max-width: 82%; padding: 0.6rem 0.85rem; border-radius: 12px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
    .bh-msg.user { background: var(--primary, #e94560); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .bh-msg.ai { background: var(--bg-elevated, #252540); color: var(--text, #e0e0e0); align-self: flex-start; border-bottom-left-radius: 4px; }
    .bh-msg.typing { opacity: 0.6; font-style: italic; }
    #bh-chat-input-row { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--border, #2a2a3e); flex-shrink: 0; background: var(--bg-card, #1a1a2e); }
    #bh-chat-input { flex: 1; background: var(--bg-elevated, #252540); border: 1px solid var(--border, #2a2a3e); border-radius: 8px; color: var(--text, #e0e0e0); padding: 0.55rem 0.75rem; font-size: 0.88rem; outline: none; resize: none; height: 38px; max-height: 90px; overflow-y: auto; font-family: inherit; }
    #bh-chat-input:focus { border-color: var(--primary, #e94560); }
    #bh-chat-send { background: var(--primary, #e94560); color: #fff; border: none; border-radius: 8px; padding: 0 0.85rem; cursor: pointer; font-size: 0.88rem; font-weight: 600; flex-shrink: 0; transition: opacity 0.2s; }
    #bh-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (max-width: 480px) {
      #bh-chat-widget { bottom: 1rem; right: 1rem; }
      #bh-chat-box { width: calc(100vw - 2rem); height: 400px; }
    }
  `;
  document.head.appendChild(style);

  // ---- Inject HTML ----
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
        <textarea id="bh-chat-input" rows="1" maxlength="500"></textarea>
        <button id="bh-chat-send"></button>
      </div>
    </div>
    <button id="bh-chat-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span id="bh-chat-btn-label"></span>
    </button>
  `;
  document.body.appendChild(widget);

  // ---- State ----
  const history = [];
  let isOpen = false;
  let isBusy = false;

  const box = document.getElementById('bh-chat-box');
  const btn = document.getElementById('bh-chat-btn');
  const closeBtn = document.getElementById('bh-chat-close');
  const messages = document.getElementById('bh-chat-messages');
  const input = document.getElementById('bh-chat-input');
  const sendBtn = document.getElementById('bh-chat-send');

  function updateLabels() {
    document.getElementById('bh-chat-title').textContent = L('title');
    document.getElementById('bh-chat-btn-label').textContent = L('open');
    input.placeholder = L('placeholder');
    sendBtn.textContent = L('send');
  }
  updateLabels();

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

  function open() {
    isOpen = true;
    box.classList.add('open');
    btn.style.display = 'none';
    if (messages.children.length === 0) addMessage(L('welcome'), 'ai');
    input.focus();
  }

  function close() {
    isOpen = false;
    box.classList.remove('open');
    btn.style.display = 'flex';
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  async function send() {
    const text = input.value.trim();
    if (!text || isBusy) return;
    isBusy = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = '38px';

    addMessage(text, 'user');
    const typing = addMessage('...', 'ai typing');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Something went wrong.';
      typing.className = 'bh-msg ai';
      typing.innerHTML = escapeHTML(reply).replace(/\n/g, '<br>');
      history.push({ role: 'user', text });
      history.push({ role: 'model', text: reply });
      if (history.length > 12) history.splice(0, 2);
    } catch (_) {
      typing.className = 'bh-msg ai';
      typing.textContent = 'Connection error. Please try again.';
    }

    messages.scrollTop = messages.scrollHeight;
    isBusy = false;
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = '38px';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  // Update labels if language changes
  window.addEventListener('bh-lang-change', updateLabels);
})();

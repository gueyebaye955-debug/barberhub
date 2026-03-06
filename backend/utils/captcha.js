function getCaptchaConfig() {
  const siteKey = String(process.env.CAPTCHA_SITE_KEY || '').trim();
  const secret = String(process.env.CAPTCHA_SECRET || '').trim();
  return {
    enabled: Boolean(siteKey && secret),
    siteKey,
    secret,
  };
}

async function verifyCaptchaToken(token, remoteIp = '') {
  const cfg = getCaptchaConfig();
  if (!cfg.enabled) {
    return { ok: true, enabled: false };
  }

  const candidate = String(token || '').trim();
  if (!candidate || candidate.length > 2048) {
    return { ok: false, enabled: true, error: 'CAPTCHA verification required' };
  }

  try {
    const params = new URLSearchParams();
    params.set('secret', cfg.secret);
    params.set('response', candidate);
    if (remoteIp) {
      params.set('remoteip', String(remoteIp).split(',')[0].trim());
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      return { ok: false, enabled: true, error: 'CAPTCHA service unavailable' };
    }
    const payload = await response.json();
    if (!payload?.success) {
      const reason = Array.isArray(payload?.['error-codes']) ? payload['error-codes'].join(', ') : 'CAPTCHA failed';
      return { ok: false, enabled: true, error: reason };
    }
    return { ok: true, enabled: true };
  } catch (error) {
    return { ok: false, enabled: true, error: error?.message || 'CAPTCHA validation failed' };
  }
}

module.exports = {
  getCaptchaConfig,
  verifyCaptchaToken,
};

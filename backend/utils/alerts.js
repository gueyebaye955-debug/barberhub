async function sendOpsAlert(title, details = {}) {
  const webhookUrl = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return false;

  try {
    const payload = {
      text: `[JOTMA] ${title}`,
      title,
      at: new Date().toISOString(),
      service: 'jotma-backend',
      details,
    };
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = {
  sendOpsAlert,
};

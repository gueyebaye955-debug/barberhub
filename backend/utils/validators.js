const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  if (!value || !EMAIL_RE.test(value)) return null;
  return value;
}

function cleanString(value, options = {}) {
  const { max = 255, min = 0, allowEmpty = false } = options;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

function parseImageUrl(value) {
  const raw = cleanString(value, { max: 2000 });
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === 'https:') return parsed.toString();
  if (protocol !== 'http:') return null;

  const host = parsed.hostname.toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (isLocalHost && process.env.NODE_ENV !== 'production') return parsed.toString();
  return null;
}

// Max ~1.5 MB actual image → ~2 MB base64 string
const BASE64_IMAGE_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const BASE64_MAX_BYTES = 2_097_152; // 2 MB
function parseBase64Image(value) {
  if (typeof value !== 'string') return null;
  if (value.length > BASE64_MAX_BYTES) return null;
  if (!BASE64_IMAGE_RE.test(value)) return null;
  return value;
}

function parsePositiveInt(value) {
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    number = Number(value.trim());
  } else {
    return null;
  }
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}

function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const date = value.trim();
  if (!DATE_RE.test(date)) return null;
  return date;
}

function parseHHMM(value) {
  if (typeof value !== 'string') return null;
  // Accept both "9:00" and "09:00", normalize to "HH:MM"
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  if (hours < 0 || hours > 23) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function timeToMinutes(time) {
  const parsed = parseHHMM(time);
  if (!parsed) return null;
  const [hours, minutes] = parsed.split(':').map(Number);
  return (hours * 60) + minutes;
}

function normalizeDbTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

module.exports = {
  cleanString,
  normalizeDbTime,
  normalizeEmail,
  parseBase64Image,
  parseHHMM,
  parseImageUrl,
  parseISODate,
  parsePositiveInt,
  timeToMinutes,
};

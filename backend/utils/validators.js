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
  parseHHMM,
  parseISODate,
  parsePositiveInt,
  timeToMinutes,
};

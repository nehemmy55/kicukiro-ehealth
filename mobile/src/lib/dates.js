// Date helpers. Dates travel to and from the API as 'YYYY-MM-DD' strings.
const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

// Upcoming weekdays (the clinic is open Monday–Friday)
export function nextWeekdays(count, from = new Date()) {
  const out = [];
  const d = new Date(from);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ISO weekday 1..7 (Mon..Sun)
export const isoWeekdayOf = (s) => { const d = parse(s).getDay(); return d === 0 ? 7 : d; };

export const dayShort =(s) => DAYS[parse(s).getDay()];
export const dayNum = (s) => parse(s).getDate();
export const shortLabel = (s) => `${dayShort(s)} ${dayNum(s)}`;
export const longDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const niceDate = (s) => { const d = parse(s); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

// '2026-06-14 10:42:00' -> '14 JUN 2026 · 10:42'
export function stamp(dt) {
  if (!dt) return '';
  const d = parse(dt);
  const time = dt.length > 10 ? dt.slice(11, 16) : '';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()} ${d.getFullYear()}${time && time !== '00:00' ? ` · ${time}` : ''}`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const initials = (name = '') => name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

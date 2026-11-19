// Shared helpers: dates, slot generation, settings, audit logging, notifications.
const pool = require('../db');

const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD
function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ISO weekday 1..7 (Mon..Sun) for a YYYY-MM-DD string
function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 ? 7 : day;
}

function ageFrom(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

async function getSettings() {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
  const s = {};
  rows.forEach((r) => { s[r.setting_key] = r.setting_value; });
  return {
    clinic_open: s.clinic_open || '08:00',
    clinic_close: s.clinic_close || '16:00',
    lunch_start: s.lunch_start || '12:00',
    lunch_end: s.lunch_end || '13:00',
    slot_minutes: Number(s.slot_minutes || 30),
    booking_window_days: Number(s.booking_window_days || 14),
    attention_threshold: Number(s.attention_threshold || 12),
    facility_name: s.facility_name || 'Kicukiro Health Center',
  };
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// All consultation slots for a day, based on configurable clinic hours.
function generateSlots(cfg) {
  const out = [];
  for (let t = toMin(cfg.clinic_open); t + cfg.slot_minutes <= toMin(cfg.clinic_close); t += cfg.slot_minutes) {
    if (t >= toMin(cfg.lunch_start) && t < toMin(cfg.lunch_end)) continue;
    out.push(toHHMM(t));
  }
  return out;
}

async function audit(req, action, details = '') {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, user_role, action, details, ip_address) VALUES (?,?,?,?,?)',
      [req.user ? req.user.id : null, req.user ? req.user.role : null, action, String(details).slice(0, 500), req.ip]
    );
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

// Sends the automated booking confirmation: saves an in-app notification and
// an SMS record. With SMS_PROVIDER=console the SMS is printed to the terminal;
// plug a real gateway (e.g. Africa's Talking) into sendSms() for production.
async function sendSms(phone, message) {
  if (!phone) return;
  if ((process.env.SMS_PROVIDER || 'console') === 'console') {
    console.log(`📱 SMS to ${phone}: ${message}`);
  }
}

async function notifyPatient(patientId, message) {
  const [[p]] = await pool.query('SELECT user_id, phone FROM patients WHERE id = ?', [patientId]);
  if (!p) return;
  if (p.user_id) {
    await pool.query('INSERT INTO notifications (user_id, patient_id, channel, message) VALUES (?,?,?,?)',
      [p.user_id, patientId, 'in_app', message]);
  }
  if (p.phone) {
    await pool.query('INSERT INTO notifications (user_id, patient_id, channel, recipient, message, is_read) VALUES (?,?,?,?,?,1)',
      [p.user_id, patientId, 'sms', p.phone, message]);
    await sendSms(p.phone, message);
  }
}

function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = {
  toISODate, isoWeekday, ageFrom, getSettings, generateSlots, audit, notifyPatient, prettyDate, toMin, toHHMM,
};

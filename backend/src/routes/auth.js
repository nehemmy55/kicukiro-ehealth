// 1.0 User Auth (DFD) — login, patient self-registration, current user.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken, authenticate } = require('../middleware/auth');
const { audit, ageFrom } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function profileFor(userId) {
  const [[u]] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role,
            p.id AS patient_id, p.patient_code, p.gender, p.date_of_birth,
            d.id AS doctor_id, d.specialty, dep.name AS department
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id
       LEFT JOIN departments dep ON dep.id = d.department_id
      WHERE u.id = ?`, [userId]);
  if (u && u.date_of_birth) u.age = ageFrom(u.date_of_birth);
  return u;
}

// POST /api/auth/login  { email, password, portal: 'patient' | 'staff' }
// The login screen separates the patient mobile login from the staff portal (§5.2.1).
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, portal } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Enter your user ID/email and password.' });

    const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      req.user = null;
      await audit(req, 'LOGIN_FAILED', `email=${email}`);
      return res.status(401).json({ message: 'Invalid credentials. Please try again.' });
    }
    if (!user.is_active) return res.status(403).json({ message: 'This account has been deactivated. Contact the administrator.' });
    if (portal === 'patient' && user.role !== 'patient') {
      return res.status(403).json({ message: 'Staff accounts must sign in through the Staff portal.' });
    }
    if (portal === 'staff' && user.role === 'patient') {
      return res.status(403).json({ message: 'Patient accounts must sign in through the Patient app.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    req.user = user;
    await audit(req, 'LOGIN', `${user.role} signed in`);
    res.json({ token: signToken(user), user: await profileFor(user.id) });
  } catch (e) { next(e); }
});

// POST /api/auth/register — patients register their own profile (Patient Use Case).
router.post('/register', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { full_name, email, phone, password, gender, date_of_birth, address } = req.body || {};
    if (!full_name || !email || !password || !gender || !date_of_birth || !phone) {
      return res.status(400).json({ message: 'Full name, email, phone, password, gender and date of birth are required.' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) return res.status(400).json({ message: 'Date of birth must be YYYY-MM-DD.' });
    if (!['Female', 'Male'].includes(gender)) return res.status(400).json({ message: 'Gender must be Female or Male.' });

    const cleanEmail = String(email).trim().toLowerCase();
    const [[exists]] = await conn.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (exists) return res.status(409).json({ message: 'An account with this email already exists.' });

    await conn.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [u] = await conn.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [full_name.trim(), cleanEmail, phone, hash, 'patient']);
    const [p] = await conn.query(
      `INSERT INTO patients (user_id, patient_code, full_name, gender, date_of_birth, phone, address)
       VALUES (?, CONCAT('TMP-', UUID_SHORT()), ?,?,?,?,?)`,
      [u.insertId, full_name.trim(), gender, date_of_birth, phone, address || null]);
    await conn.query("UPDATE patients SET patient_code = CONCAT('KHC-', LPAD(id, 5, '0')) WHERE id = ?", [p.insertId]);
    await conn.query(
      `INSERT INTO medical_records (patient_id, title, remarks) VALUES (?, 'Initial registration',
       'Patient profile created in the centralized database through the mobile app.')`, [p.insertId]);
    await conn.commit();

    const user = { id: u.insertId, role: 'patient' };
    req.user = user;
    await audit(req, 'REGISTER', `patient self-registration ${cleanEmail}`);
    res.status(201).json({ token: signToken(user), user: await profileFor(u.insertId) });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try { res.json(await profileFor(req.user.id)); } catch (e) { next(e); }
});

module.exports = router;

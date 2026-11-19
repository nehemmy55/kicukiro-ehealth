// Token authentication + Role-Based Access Control (§2.1.6).
const jwt = require('jsonwebtoken');
const pool = require('../db');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET(), { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

// Verifies the Bearer token and loads the current user, plus the linked
// patient/doctor profile id, onto req.user.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please sign in.' });
  try {
    const payload = jwt.verify(token, SECRET());
    const [[user]] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active,
              p.id AS patient_id, d.id AS doctor_id
         FROM users u
         LEFT JOIN patients p ON p.user_id = u.id
         LEFT JOIN doctors d ON d.user_id = u.id
        WHERE u.id = ?`, [payload.id]);
    if (!user || !user.is_active) return res.status(401).json({ message: 'Account is disabled or no longer exists.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
}

// Usage: authorize('admin', 'doctor')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to access this module.' });
  }
  next();
};

module.exports = { signToken, authenticate, authorize };

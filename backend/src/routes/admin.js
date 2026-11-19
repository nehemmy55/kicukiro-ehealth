// Administrator Use Case: manage users, configurations, audit logs, backups.
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { audit } = require('../utils/helpers');

router.use(authenticate, authorize('admin'));

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

// ---------- Manage System Users (Add/Remove Staff) ----------
router.get('/users', async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.role) { where = 'WHERE u.role = ?'; params.push(req.query.role); }
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.last_login_at, u.created_at,
              d.id AS doctor_id, d.specialty, d.working_days, dep.name AS department, d.department_id
         FROM users u
         LEFT JOIN doctors d ON d.user_id = u.id
         LEFT JOIN departments dep ON dep.id = d.department_id
         ${where} ORDER BY FIELD(u.role,'admin','doctor','reception','patient'), u.full_name`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/users', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { full_name, email, phone, password, role, department_id, specialty, working_days } = req.body || {};
    if (!full_name || !email || !password || !role) return res.status(400).json({ message: 'Name, email, password and role are required.' });
    if (!['admin', 'doctor', 'reception'].includes(role)) return res.status(400).json({ message: 'Staff role must be admin, doctor or reception.' });
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (role === 'doctor' && (!department_id || !specialty)) return res.status(400).json({ message: 'Doctors need a department and specialty.' });
    const cleanEmail = String(email).trim().toLowerCase();
    const [[exists]] = await conn.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (exists) return res.status(409).json({ message: 'That email is already in use.' });

    await conn.beginTransaction();
    const [u] = await conn.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [full_name.trim(), cleanEmail, phone || null, await bcrypt.hash(password, 10), role]);
    if (role === 'doctor') {
      await conn.query('INSERT INTO doctors (user_id, department_id, specialty, working_days) VALUES (?,?,?,?)',
        [u.insertId, department_id, specialty, working_days || '1,2,3,4,5']);
    }
    await conn.commit();
    await audit(req, 'ADD_USER', `${role} ${cleanEmail}`);
    res.status(201).json({ id: u.insertId, message: `${full_name} added as ${role}.` });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
});

// PATCH /api/admin/users/:id — activate/deactivate, edit details
router.patch('/users/:id', async (req, res, next) => {
  try {
    const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'User not found.' });
    if (u.id === req.user.id && req.body.is_active === false) return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    const f = { ...u, ...req.body };
    await pool.query('UPDATE users SET full_name = ?, phone = ?, is_active = ? WHERE id = ?',
      [f.full_name, f.phone, f.is_active ? 1 : 0, u.id]);
    if (req.body.password) {
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(req.body.password, 10), u.id]);
    }
    if (u.role === 'doctor' && (req.body.specialty || req.body.department_id || req.body.working_days)) {
      await pool.query(
        `UPDATE doctors SET specialty = COALESCE(?, specialty), department_id = COALESCE(?, department_id),
           working_days = COALESCE(?, working_days) WHERE user_id = ?`,
        [req.body.specialty || null, req.body.department_id || null, req.body.working_days || null, u.id]);
    }
    await audit(req, 'UPDATE_USER', `user #${u.id} active=${f.is_active ? 1 : 0}`);
    res.json({ message: 'User updated.' });
  } catch (e) { next(e); }
});

// DELETE /api/admin/users/:id — removes staff. Staff with clinical history are
// deactivated instead, so medical records keep their author.
router.delete('/users/:id', async (req, res, next) => {
  try {
    const [[u]] = await pool.query('SELECT id, role, full_name FROM users WHERE id = ?', [req.params.id]);
    if (!u) return res.status(404).json({ message: 'User not found.' });
    if (u.id === req.user.id) return res.status(400).json({ message: 'You cannot remove your own account.' });
    if (u.role === 'patient') return res.status(400).json({ message: 'Patient accounts cannot be removed here; deactivate them instead.' });
    const [[hist]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE d.user_id = ?) +
              (SELECT COUNT(*) FROM medical_records r JOIN doctors d ON d.id = r.doctor_id WHERE d.user_id = ?) AS n`,
      [u.id, u.id]);
    if (hist.n > 0) {
      await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [u.id]);
      await audit(req, 'DEACTIVATE_USER', `user #${u.id} (has clinical history)`);
      return res.json({ message: `${u.full_name} has clinical history, so the account was deactivated instead of deleted.` });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [u.id]);
    await audit(req, 'REMOVE_USER', `user #${u.id} ${u.full_name}`);
    res.json({ message: `${u.full_name} was removed.` });
  } catch (e) { next(e); }
});

// ---------- Update System Configurations ----------
router.get('/settings', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT setting_key, setting_value, description FROM settings
        ORDER BY FIELD(setting_key, 'facility_name','clinic_open','clinic_close','lunch_start','lunch_end',
                       'slot_minutes','booking_window_days','attention_threshold')`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const updates = req.body || {};
    const time = /^\d{2}:\d{2}$/;
    const rules = {
      clinic_open: time, clinic_close: time, lunch_start: time, lunch_end: time,
      slot_minutes: /^(10|15|20|30|45|60)$/, booking_window_days: /^\d{1,2}$/, attention_threshold: /^\d{1,3}$/, facility_name: /.+/,
    };
    for (const [k, v] of Object.entries(updates)) {
      if (!rules[k]) return res.status(400).json({ message: `Unknown setting "${k}".` });
      if (!rules[k].test(String(v))) return res.status(400).json({ message: `Invalid value for ${k}.` });
    }
    for (const [k, v] of Object.entries(updates)) {
      await pool.query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [String(v), k]);
    }
    await audit(req, 'UPDATE_SETTINGS', Object.keys(updates).join(', '));
    res.json({ message: 'Settings saved.' });
  } catch (e) { next(e); }
});

// ---------- Generate Security/Audit Logs ----------
router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const [rows] = await pool.query(
      `SELECT l.id, l.action, l.details, l.ip_address, l.user_role, l.created_at, u.full_name
         FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.id DESC LIMIT ?`, [limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- Manage Database Backups ----------
router.get('/backups', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, u.full_name AS created_by_name FROM backups b LEFT JOIN users u ON u.id = b.created_by
        ORDER BY b.id DESC LIMIT 50`);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/admin/backups — snapshot every table to a JSON file in backend/backups/.
// In production, copy this folder to cloud storage on a schedule (§1.6).
router.post('/backups', async (req, res, next) => {
  try {
    const tables = ['users', 'departments', 'doctors', 'patients', 'appointments', 'medical_records',
      'notifications', 'settings', 'audit_logs', 'backups'];
    const dump = { created_at: new Date().toISOString(), tables: {} };
    let rowCount = 0;
    for (const t of tables) {
      const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
      dump.tables[t] = rows;
      rowCount += rows.length;
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `kicukiro-ehealth-${stamp}.json`;
    const body = JSON.stringify(dump);
    fs.writeFileSync(path.join(BACKUP_DIR, fileName), body);
    const [r] = await pool.query('INSERT INTO backups (file_name, size_bytes, row_count, created_by) VALUES (?,?,?,?)',
      [fileName, Buffer.byteLength(body), rowCount, req.user.id]);
    await audit(req, 'RUN_BACKUP', fileName);
    res.status(201).json({ id: r.insertId, file_name: fileName, size_bytes: Buffer.byteLength(body), row_count: rowCount, message: 'Backup completed.' });
  } catch (e) { next(e); }
});

module.exports = router;

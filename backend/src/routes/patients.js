// Patients: search (doctors/reception/admin) and walk-in registration (reception).
const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSettings, generateSlots, isoWeekday, toISODate, toMin, audit, ageFrom,
} = require('../utils/helpers');

router.use(authenticate);

// GET /api/patients?q=uwase
router.get('/', authorize('doctor', 'reception', 'admin'), async (req, res, next) => {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const [rows] = await pool.query(
      `SELECT p.id, p.patient_code, p.full_name, p.gender, p.date_of_birth, p.phone, p.address,
              dep.name AS department,
              (SELECT MAX(recorded_at) FROM medical_records r WHERE r.patient_id = p.id) AS last_visit
         FROM patients p LEFT JOIN departments dep ON dep.id = p.department_id
        WHERE p.full_name LIKE ? OR p.patient_code LIKE ? OR p.phone LIKE ?
        ORDER BY p.full_name LIMIT 100`, [q, q, q]);
    res.json(rows.map((r) => ({ ...r, age: ageFrom(r.date_of_birth) })));
  } catch (e) { next(e); }
});

// GET /api/patients/:id — basic profile
router.get('/:id', authorize('doctor', 'reception', 'admin'), async (req, res, next) => {
  try {
    const [[p]] = await pool.query(
      `SELECT p.*, dep.name AS department FROM patients p
         LEFT JOIN departments dep ON dep.id = p.department_id WHERE p.id = ?`, [req.params.id]);
    if (!p) return res.status(404).json({ message: 'Patient not found.' });
    res.json({ ...p, age: ageFrom(p.date_of_birth) });
  } catch (e) { next(e); }
});

// POST /api/patients/walk-in (Reception Use Case: "Register Walk-in Patients")
// Body: { patient_id? | full_name, gender, date_of_birth, phone, address },
//       department_id, doctor_id?, reason?
// Creates (or reuses) the patient and places them in today's queue at the
// next free slot, already checked in.
router.post('/walk-in', authorize('reception', 'admin'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    if (!b.department_id) return res.status(400).json({ message: 'Choose a department.' });
    if (!b.patient_id && (!b.full_name || !b.gender || !b.date_of_birth)) {
      return res.status(400).json({ message: 'Full name, gender and date of birth are required for a new patient.' });
    }
    if (b.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(b.date_of_birth)) {
      return res.status(400).json({ message: 'Date of birth must be YYYY-MM-DD.' });
    }

    // Find doctors in the department who consult today
    const today = toISODate();
    const dow = isoWeekday(today);
    const params = [b.department_id];
    let docFilter = '';
    if (b.doctor_id) { docFilter = ' AND d.id = ?'; params.push(b.doctor_id); }
    const [docs] = await conn.query(
      `SELECT d.id, d.working_days, u.full_name FROM doctors d JOIN users u ON u.id = d.user_id
        WHERE u.is_active = 1 AND d.department_id = ? ${docFilter}`, params);
    const onDuty = docs.filter((d) => d.working_days.split(',').map(Number).includes(dow));
    if (!onDuty.length) return res.status(409).json({ message: 'No doctor from this department is on duty today.' });

    const cfg = await getSettings();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    // Walk-ins take the current slot or later
    const slots = generateSlots(cfg).filter((s) => toMin(s) + cfg.slot_minutes > nowMin);
    if (!slots.length) {
      return res.status(409).json({ message: `The clinic has closed for today (last slot ends ${cfg.clinic_close}). Book the patient for another day instead.` });
    }

    await conn.beginTransaction();
    let patientId = b.patient_id;
    if (!patientId) {
      const [p] = await conn.query(
        `INSERT INTO patients (patient_code, full_name, gender, date_of_birth, phone, address, department_id)
         VALUES (CONCAT('TMP-', UUID_SHORT()), ?,?,?,?,?,?)`,
        [b.full_name.trim(), b.gender, b.date_of_birth, b.phone || null, b.address || null, b.department_id]);
      patientId = p.insertId;
      await conn.query("UPDATE patients SET patient_code = CONCAT('KHC-', LPAD(id, 5, '0')) WHERE id = ?", [patientId]);
      await conn.query(
        `INSERT INTO medical_records (patient_id, title, remarks) VALUES (?, 'Initial registration',
         'Walk-in patient registered at reception.')`, [patientId]);
    }

    // Try every slot × doctor until an insert succeeds (unique key prevents double-booking)
    let apptId = null; let chosen = null;
    for (const slot of slots) {
      for (const d of onDuty) {
        try {
          const [r] = await conn.query(
            `INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, slot_time, status, source, reason, checked_in_at)
             VALUES (?,?,?,?,?, 'checked_in', 'walk_in', ?, NOW())`,
            [patientId, d.id, b.department_id, today, slot, b.reason || 'Walk-in consultation']);
          apptId = r.insertId; chosen = { slot, doctor: d.full_name };
          break;
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
      if (apptId) break;
    }
    if (!apptId) {
      await conn.rollback();
      return res.status(409).json({ message: 'All of today\'s slots in this department are full.' });
    }
    await conn.commit();

    await audit(req, 'WALK_IN', `patient #${patientId} appt #${apptId} ${chosen.slot}`);
    const [[p]] = await pool.query('SELECT id, patient_code, full_name FROM patients WHERE id = ?', [patientId]);
    res.status(201).json({
      patient: p, appointment_id: apptId, slot_time: chosen.slot, doctor_name: chosen.doctor,
      message: `${p.full_name} (${p.patient_code}) queued with ${chosen.doctor} at ${chosen.slot}.`,
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;

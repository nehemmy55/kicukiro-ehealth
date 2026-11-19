// 3.0 Medical Records (DFD) — clinical notes, vitals, diagnoses, prescriptions.
const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { audit, ageFrom } = require('../utils/helpers');

router.use(authenticate);

const REC_SELECT = `
  SELECT r.id, r.patient_id, r.doctor_id, r.appointment_id, r.title, r.vital_signs, r.diagnosis,
         r.prescription, r.remarks, r.recorded_at, u.full_name AS doctor_name, dep.name AS department
    FROM medical_records r
    LEFT JOIN doctors d ON d.id = r.doctor_id
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN departments dep ON dep.id = d.department_id`;

// GET /api/records/mine — patient views own medical history
router.get('/mine', authorize('patient'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${REC_SELECT} WHERE r.patient_id = ? ORDER BY r.recorded_at DESC`, [req.user.patient_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/records/patient/:id — doctors (and admin) retrieve a patient's full history
router.get('/patient/:id', authorize('doctor', 'admin'), async (req, res, next) => {
  try {
    const [[p]] = await pool.query(
      `SELECT p.id, p.patient_code, p.full_name, p.gender, p.date_of_birth, p.phone, dep.name AS department
         FROM patients p LEFT JOIN departments dep ON dep.id = p.department_id WHERE p.id = ?`, [req.params.id]);
    if (!p) return res.status(404).json({ message: 'Patient not found.' });
    const [records] = await pool.query(`${REC_SELECT} WHERE r.patient_id = ? ORDER BY r.recorded_at DESC`, [p.id]);
    await audit(req, 'VIEW_RECORDS', `patient #${p.id}`);
    res.json({ patient: { ...p, age: ageFrom(p.date_of_birth) }, records });
  } catch (e) { next(e); }
});

// POST /api/records — "Add Clinical Note" modal (Figure 13)
router.post('/', authorize('doctor'), async (req, res, next) => {
  try {
    const { patient_id, appointment_id, title, vital_signs, diagnosis, prescription, remarks } = req.body || {};
    if (!patient_id) return res.status(400).json({ message: 'patient_id is required.' });
    if (!diagnosis && !remarks) return res.status(400).json({ message: 'Enter at least a diagnosis or remarks.' });
    const [[p]] = await pool.query('SELECT id FROM patients WHERE id = ?', [patient_id]);
    if (!p) return res.status(404).json({ message: 'Patient not found.' });

    const [[dep]] = await pool.query(
      'SELECT dep.name FROM doctors d JOIN departments dep ON dep.id = d.department_id WHERE d.id = ?', [req.user.doctor_id]);
    const [r] = await pool.query(
      `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, title, vital_signs, diagnosis, prescription, remarks)
       VALUES (?,?,?,?,?,?,?,?)`,
      [patient_id, req.user.doctor_id, appointment_id || null, title || `Consultation — ${dep ? dep.name : 'General'}`,
        vital_signs || null, diagnosis || null, prescription || null, remarks || null]);

    // Recording a note for an appointment completes that consultation.
    if (appointment_id) {
      await pool.query(
        "UPDATE appointments SET status = 'completed' WHERE id = ? AND doctor_id = ? AND status IN ('booked','checked_in')",
        [appointment_id, req.user.doctor_id]);
    }
    await audit(req, 'ADD_CLINICAL_NOTE', `record #${r.insertId} patient #${patient_id}`);
    const [[rec]] = await pool.query(`${REC_SELECT} WHERE r.id = ?`, [r.insertId]);
    res.status(201).json(rec);
  } catch (e) { next(e); }
});

// PUT /api/records/:id — authorized doctors can edit/update records during a visit
router.put('/:id', authorize('doctor'), async (req, res, next) => {
  try {
    const [[rec]] = await pool.query('SELECT * FROM medical_records WHERE id = ?', [req.params.id]);
    if (!rec) return res.status(404).json({ message: 'Record not found.' });
    if (rec.doctor_id !== req.user.doctor_id) return res.status(403).json({ message: 'You can only edit notes you wrote.' });
    const f = { ...rec, ...req.body };
    await pool.query(
      'UPDATE medical_records SET title = ?, vital_signs = ?, diagnosis = ?, prescription = ?, remarks = ? WHERE id = ?',
      [f.title, f.vital_signs, f.diagnosis, f.prescription, f.remarks, rec.id]);
    await audit(req, 'EDIT_CLINICAL_NOTE', `record #${rec.id}`);
    const [[updated]] = await pool.query(`${REC_SELECT} WHERE r.id = ?`, [rec.id]);
    res.json(updated);
  } catch (e) { next(e); }
});

module.exports = router;

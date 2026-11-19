// 2.0 Appointment Management (DFD) — book, cancel, reschedule, daily queues.
const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSettings, generateSlots, isoWeekday, toISODate, toMin, audit, notifyPatient, prettyDate,
} = require('../utils/helpers');

router.use(authenticate);

const APPT_SELECT = `
  SELECT a.id, a.patient_id, a.doctor_id, a.department_id, a.appt_date,
         TIME_FORMAT(a.slot_time, '%H:%i') AS slot_time, a.status, a.source, a.reason,
         a.checked_in_at, a.created_at,
         p.full_name AS patient_name, p.patient_code, p.phone AS patient_phone,
         du.full_name AS doctor_name, dep.name AS department
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users du ON du.id = d.user_id
    JOIN departments dep ON dep.id = a.department_id`;

// Validates that a doctor can take a booking at date/time. Returns {doctor} or throws {status,message}.
async function validateSlot(doctorId, date, time, { allowPast = false } = {}) {
  const err = (status, message) => Object.assign(new Error(message), { status });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw err(400, 'Choose a valid date.');
  if (!/^\d{2}:\d{2}$/.test(time || '')) throw err(400, 'Choose a valid time slot.');

  const cfg = await getSettings();
  const today = toISODate();
  const max = new Date(); max.setDate(max.getDate() + cfg.booking_window_days);
  if (!allowPast && date < today) throw err(400, 'You cannot book a date in the past.');
  if (date > toISODate(max)) throw err(400, `Bookings can only be made up to ${cfg.booking_window_days} days ahead.`);
  if (!generateSlots(cfg).includes(time)) throw err(400, 'That time is not a consultation slot.');
  if (!allowPast && date === today) {
    const now = new Date();
    if (toMin(time) <= now.getHours() * 60 + now.getMinutes()) throw err(400, 'That time slot has already passed.');
  }

  const [[doctor]] = await pool.query(
    `SELECT d.id, d.department_id, d.working_days, u.full_name
       FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND u.is_active = 1`, [doctorId]);
  if (!doctor) throw err(404, 'Doctor not found.');
  if (!doctor.working_days.split(',').map(Number).includes(isoWeekday(date))) {
    throw err(400, `${doctor.full_name} does not consult on that day.`);
  }
  return doctor;
}

const isDuplicate = (e) => e && e.code === 'ER_DUP_ENTRY';
const SLOT_TAKEN = 'Sorry, that slot was just taken. Please pick another time.';

// POST /api/appointments — patient books for themselves; reception can book for any patient.
router.post('/', authorize('patient', 'reception', 'admin'), async (req, res, next) => {
  try {
    const { doctor_id, appt_date, slot_time, reason } = req.body || {};
    const patientId = req.user.role === 'patient' ? req.user.patient_id : req.body.patient_id;
    if (!patientId) return res.status(400).json({ message: 'patient_id is required.' });

    const doctor = await validateSlot(doctor_id, appt_date, slot_time);

    // Stop a patient holding two bookings at the same time.
    const [[clash]] = await pool.query(
      "SELECT id FROM appointments WHERE patient_id = ? AND appt_date = ? AND slot_time = ? AND status <> 'cancelled'",
      [patientId, appt_date, slot_time]);
    if (clash) return res.status(409).json({ message: 'You already have an appointment at that time.' });

    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, slot_time, source, reason)
         VALUES (?,?,?,?,?,?,?)`,
        [patientId, doctor.id, doctor.department_id, appt_date, slot_time,
          req.user.role === 'patient' ? 'mobile' : 'walk_in', reason || null]);
    } catch (e) {
      if (isDuplicate(e)) return res.status(409).json({ message: SLOT_TAKEN });
      throw e;
    }

    await notifyPatient(patientId,
      `Kicukiro HC: Your appointment with ${doctor.full_name} is confirmed for ${prettyDate(appt_date)} at ${slot_time}. Ref #${result.insertId}.`);
    await audit(req, 'BOOK_APPOINTMENT', `appt #${result.insertId} doctor=${doctor.id} ${appt_date} ${slot_time}`);

    const [[appt]] = await pool.query(`${APPT_SELECT} WHERE a.id = ?`, [result.insertId]);
    res.status(201).json(appt);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
});

// GET /api/appointments/mine — patient's upcoming and past appointments
router.get('/mine', authorize('patient'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${APPT_SELECT} WHERE a.patient_id = ? ORDER BY a.appt_date DESC, a.slot_time DESC`, [req.user.patient_id]);
    const today = toISODate();
    res.json({
      upcoming: rows.filter((r) => r.appt_date >= today && ['booked', 'checked_in'].includes(r.status)).reverse(),
      past: rows.filter((r) => !(r.appt_date >= today && ['booked', 'checked_in'].includes(r.status))),
    });
  } catch (e) { next(e); }
});

// GET /api/appointments/queue?date=&doctor_id=
// Doctors: their own daily schedule. Reception/Admin: the full daily queue.
router.get('/queue', authorize('doctor', 'reception', 'admin'), async (req, res, next) => {
  try {
    const date = req.query.date || toISODate();
    const params = [date];
    let where = 'WHERE a.appt_date = ? AND a.status <> \'cancelled\'';
    if (req.user.role === 'doctor') { where += ' AND a.doctor_id = ?'; params.push(req.user.doctor_id); }
    else if (req.query.doctor_id) { where += ' AND a.doctor_id = ?'; params.push(req.query.doctor_id); }
    if (req.query.department_id) { where += ' AND a.department_id = ?'; params.push(req.query.department_id); }
    const [rows] = await pool.query(`${APPT_SELECT} ${where} ORDER BY a.slot_time, du.full_name`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

async function loadOwned(req, id) {
  const [[appt]] = await pool.query(`${APPT_SELECT} WHERE a.id = ?`, [id]);
  if (!appt) return { error: [404, 'Appointment not found.'] };
  if (req.user.role === 'patient' && appt.patient_id !== req.user.patient_id) return { error: [403, 'Not your appointment.'] };
  if (req.user.role === 'doctor' && appt.doctor_id !== req.user.doctor_id) return { error: [403, 'Not your patient.'] };
  return { appt };
}

// PATCH /api/appointments/:id/cancel
router.patch('/:id/cancel', authorize('patient', 'reception', 'admin'), async (req, res, next) => {
  try {
    const { appt, error } = await loadOwned(req, req.params.id);
    if (error) return res.status(error[0]).json({ message: error[1] });
    if (appt.status !== 'booked') return res.status(400).json({ message: `This appointment is already ${appt.status.replace('_', ' ')}.` });
    await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [appt.id]);
    await notifyPatient(appt.patient_id,
      `Kicukiro HC: Your appointment with ${appt.doctor_name} on ${prettyDate(appt.appt_date)} at ${appt.slot_time} has been cancelled.`);
    await audit(req, 'CANCEL_APPOINTMENT', `appt #${appt.id}`);
    res.json({ message: 'Appointment cancelled.' });
  } catch (e) { next(e); }
});

// PATCH /api/appointments/:id/reschedule  { appt_date, slot_time, doctor_id? }
router.patch('/:id/reschedule', authorize('patient', 'reception', 'admin'), async (req, res, next) => {
  try {
    const { appt, error } = await loadOwned(req, req.params.id);
    if (error) return res.status(error[0]).json({ message: error[1] });
    if (appt.status !== 'booked') return res.status(400).json({ message: 'Only booked appointments can be rescheduled.' });
    const { appt_date, slot_time } = req.body || {};
    const doctor = await validateSlot(req.body.doctor_id || appt.doctor_id, appt_date, slot_time);
    try {
      await pool.query('UPDATE appointments SET doctor_id = ?, department_id = ?, appt_date = ?, slot_time = ? WHERE id = ?',
        [doctor.id, doctor.department_id, appt_date, slot_time, appt.id]);
    } catch (e) {
      if (isDuplicate(e)) return res.status(409).json({ message: SLOT_TAKEN });
      throw e;
    }
    await notifyPatient(appt.patient_id,
      `Kicukiro HC: Your appointment has been moved to ${prettyDate(appt_date)} at ${slot_time} with ${doctor.full_name}.`);
    await audit(req, 'RESCHEDULE_APPOINTMENT', `appt #${appt.id} -> ${appt_date} ${slot_time}`);
    const [[updated]] = await pool.query(`${APPT_SELECT} WHERE a.id = ?`, [appt.id]);
    res.json(updated);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
});

// PATCH /api/appointments/:id/status  { status }
// Reception verifies physical attendance (checked_in / no_show); doctors complete consultations.
router.patch('/:id/status', authorize('doctor', 'reception', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = {
      reception: ['checked_in', 'no_show', 'booked'],
      doctor: ['completed', 'no_show'],
      admin: ['booked', 'checked_in', 'completed', 'no_show'],
    }[req.user.role];
    if (!allowed.includes(status)) return res.status(400).json({ message: `You cannot set status to "${status}".` });
    const { appt, error } = await loadOwned(req, req.params.id);
    if (error) return res.status(error[0]).json({ message: error[1] });
    if (appt.status === 'cancelled') return res.status(400).json({ message: 'This appointment was cancelled.' });

    await pool.query(
      `UPDATE appointments SET status = ?,
         checked_in_at = CASE WHEN ? = 'checked_in' THEN NOW() WHEN ? = 'booked' THEN NULL ELSE checked_in_at END
       WHERE id = ?`, [status, status, status, appt.id]);
    await audit(req, 'APPOINTMENT_STATUS', `appt #${appt.id} ${appt.status} -> ${status}`);
    const [[updated]] = await pool.query(`${APPT_SELECT} WHERE a.id = ?`, [appt.id]);
    res.json(updated);
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.validateSlot = validateSlot;
module.exports.APPT_SELECT = APPT_SELECT;

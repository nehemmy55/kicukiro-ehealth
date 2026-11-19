// Browse Departments & Doctors + available time slots (Patient Use Case).
const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { getSettings, generateSlots, isoWeekday, toISODate, toMin } = require('../utils/helpers');

router.use(authenticate);

// GET /api/departments
router.get('/departments', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM departments ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/doctors?department_id=1
router.get('/doctors', async (req, res, next) => {
  try {
    const params = [];
    let where = 'WHERE u.is_active = 1';
    if (req.query.department_id) { where += ' AND d.department_id = ?'; params.push(req.query.department_id); }
    const [rows] = await pool.query(
      `SELECT d.id, u.full_name, d.specialty, d.working_days, d.department_id, dep.name AS department
         FROM doctors d JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id
         ${where} ORDER BY u.full_name`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
// Returns every slot of the day with available=true/false so the app can
// show taken slots struck through, as in the booking interface (Figure 11).
router.get('/doctors/:id/slots', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    const [[doc]] = await pool.query(
      'SELECT d.id, d.working_days FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND u.is_active = 1',
      [req.params.id]);
    if (!doc) return res.status(404).json({ message: 'Doctor not found.' });

    const cfg = await getSettings();
    const works = doc.working_days.split(',').map(Number).includes(isoWeekday(date));
    if (!works) return res.json({ date, working: false, slots: [] });

    const [taken] = await pool.query(
      "SELECT TIME_FORMAT(slot_time, '%H:%i') AS t FROM appointments WHERE doctor_id = ? AND appt_date = ? AND status <> 'cancelled'",
      [doc.id, date]);
    const takenSet = new Set(taken.map((r) => r.t));

    const now = new Date();
    const isToday = date === toISODate(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = generateSlots(cfg).map((time) => ({
      time,
      available: !takenSet.has(time) && !(isToday && toMin(time) <= nowMin),
    }));
    res.json({ date, working: true, slots });
  } catch (e) { next(e); }
});

// GET /api/settings/public — clinic hours & booking window for the app
router.get('/settings/public', async (req, res, next) => {
  try {
    const s = await getSettings();
    res.json({ booking_window_days: s.booking_window_days, clinic_open: s.clinic_open, clinic_close: s.clinic_close, facility_name: s.facility_name });
  } catch (e) { next(e); }
});

module.exports = router;

// Main Navigation Dashboard (§5.2.2) and Reports Generation (§5.2.5).
const router = require('express').Router();
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { toISODate, isoWeekday, getSettings, generateSlots, toMin, ageFrom, audit } = require('../utils/helpers');

router.use(authenticate);

const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
};

// GET /api/dashboard?date=YYYY-MM-DD
router.get('/dashboard', authorize('doctor', 'reception', 'admin'), async (req, res, next) => {
  try {
    const date = req.query.date || toISODate();
    const lastWeek = shiftDate(date, -7);
    const cfg = await getSettings();

    const [[{ today }]] = await pool.query(
      "SELECT COUNT(*) AS today FROM appointments WHERE appt_date = ? AND status <> 'cancelled'", [date]);
    const [[{ prev }]] = await pool.query(
      "SELECT COUNT(*) AS prev FROM appointments WHERE appt_date = ? AND status <> 'cancelled'", [lastWeek]);
    const [docs] = await pool.query(
      'SELECT d.working_days, d.department_id FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.is_active = 1');
    const dow = isoWeekday(date);
    const onDuty = docs.filter((d) => d.working_days.split(',').map(Number).includes(dow));
    const [deps] = await pool.query('SELECT id, name FROM departments ORDER BY id');
    const staffed = deps.every((dep) => onDuty.some((d) => d.department_id === dep.id));
    const [[{ patients }]] = await pool.query('SELECT COUNT(*) AS patients FROM patients');
    const [[{ newThisWeek }]] = await pool.query(
      'SELECT COUNT(*) AS newThisWeek FROM patients WHERE created_at >= ?', [`${shiftDate(date, -6)} 00:00:00`]);

    // Peak consultation hours — one bar per clinic hour
    const [byHour] = await pool.query(
      `SELECT HOUR(slot_time) AS h, COUNT(*) AS n FROM appointments
        WHERE appt_date = ? AND status <> 'cancelled' GROUP BY HOUR(slot_time)`, [date]);
    const hourMap = Object.fromEntries(byHour.map((r) => [r.h, r.n]));
    const peak = [];
    for (let h = Math.floor(toMin(cfg.clinic_open) / 60); h < Math.ceil(toMin(cfg.clinic_close) / 60); h += 1) {
      const fmt = (x) => (x > 12 ? x - 12 : x);
      peak.push({ label: `${fmt(h)}–${fmt(h + 1)}`, hour: h, count: hourMap[h] || 0 });
    }

    // Department load = today's bookings / today's capacity
    const [byDept] = await pool.query(
      `SELECT department_id, COUNT(*) AS n FROM appointments
        WHERE appt_date = ? AND status <> 'cancelled' GROUP BY department_id`, [date]);
    const deptMap = Object.fromEntries(byDept.map((r) => [r.department_id, r.n]));
    const slotsPerDoctor = generateSlots(cfg).length;
    const departmentLoad = deps.map((dep) => {
      const capacity = onDuty.filter((d) => d.department_id === dep.id).length * slotsPerDoctor;
      const n = deptMap[dep.id] || 0;
      return { id: dep.id, name: dep.name, count: n, capacity, load: capacity ? Math.min(1, n / capacity) : 0 };
    });

    const [statusRows] = await pool.query(
      'SELECT status, COUNT(*) AS n FROM appointments WHERE appt_date = ? GROUP BY status', [date]);
    const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));

    let mine = null;
    if (req.user.role === 'doctor') {
      const [[m]] = await pool.query(
        `SELECT COUNT(*) AS total, SUM(status = 'completed') AS completed, SUM(status = 'checked_in') AS waiting
           FROM appointments WHERE appt_date = ? AND doctor_id = ? AND status <> 'cancelled'`, [date, req.user.doctor_id]);
      mine = { total: m.total, completed: Number(m.completed || 0), waiting: Number(m.waiting || 0) };
    }

    res.json({
      date,
      kpis: {
        appointmentsToday: today,
        changeVsLastWeek: prev ? Math.round(((today - prev) / prev) * 100) : null,
        doctorsOnDuty: onDuty.length,
        allDepartmentsStaffed: staffed,
        totalPatients: patients,
        newPatientsThisWeek: newThisWeek,
      },
      statusCounts,
      peakHours: peak,
      departmentLoad,
      mine,
    });
  } catch (e) { next(e); }
});

// ----------------------------------------------------------------------
// Reports — each returns { title, columns, rows } so the app can render a
// table and export it to CSV or PDF.
// ----------------------------------------------------------------------
const REPORTS = {
  // Daily Attendance — patients seen per time block and department
  async attendance(date, cfg) {
    const [rows] = await pool.query(
      `SELECT HOUR(a.slot_time) AS h, dep.name AS department,
              COUNT(*) AS booked,
              SUM(a.status IN ('checked_in','completed')) AS seen,
              SUM(a.status = 'no_show') AS no_show
         FROM appointments a JOIN departments dep ON dep.id = a.department_id
        WHERE a.appt_date = ? AND a.status <> 'cancelled'
        GROUP BY HOUR(a.slot_time), dep.name ORDER BY h, dep.name`, [date]);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      title: 'Daily Attendance',
      columns: [
        { key: 'time_block', label: 'Time block' }, { key: 'department', label: 'Department' },
        { key: 'booked', label: 'Booked' }, { key: 'seen', label: 'Patients seen' },
        { key: 'no_show', label: 'No-shows' }, { key: 'status', label: 'Status' },
      ],
      rows: rows.map((r) => ({
        time_block: `${pad(r.h)}:00–${pad(r.h + 1)}:00`,
        department: r.department,
        booked: Number(r.booked),
        seen: Number(r.seen),
        no_show: Number(r.no_show),
        status: Number(r.booked) >= cfg.attention_threshold || Number(r.no_show) >= 3 ? 'Needs attention' : 'On track',
      })),
    };
  },

  // Doctor Schedules — capacity vs bookings per doctor on the date
  async 'doctor-schedules'(date, cfg) {
    const [docs] = await pool.query(
      `SELECT d.id, u.full_name, dep.name AS department, d.working_days,
              SUM(a.status IS NOT NULL) AS booked,
              SUM(a.status = 'completed') AS completed,
              SUM(a.status = 'checked_in') AS waiting,
              TIME_FORMAT(MIN(a.slot_time), '%H:%i') AS first_slot,
              TIME_FORMAT(MAX(a.slot_time), '%H:%i') AS last_slot
         FROM doctors d JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id
         LEFT JOIN appointments a ON a.doctor_id = d.id AND a.appt_date = ? AND a.status <> 'cancelled'
        WHERE u.is_active = 1
        GROUP BY d.id, u.full_name, dep.name, d.working_days ORDER BY dep.name, u.full_name`, [date]);
    const slots = generateSlots(cfg).length;
    const dow = isoWeekday(date);
    return {
      title: 'Doctor Schedules',
      columns: [
        { key: 'doctor', label: 'Doctor' }, { key: 'department', label: 'Department' },
        { key: 'on_duty', label: 'On duty' }, { key: 'booked', label: 'Booked' },
        { key: 'completed', label: 'Completed' }, { key: 'free', label: 'Free slots' }, { key: 'hours', label: 'First–last' },
      ],
      rows: docs.map((d) => {
        const onDuty = d.working_days.split(',').map(Number).includes(dow);
        const booked = Number(d.booked || 0);
        return {
          doctor: d.full_name, department: d.department, on_duty: onDuty ? 'Yes' : 'No',
          booked, completed: Number(d.completed || 0), free: onDuty ? Math.max(0, slots - booked) : 0,
          hours: d.first_slot ? `${d.first_slot}–${d.last_slot}` : '—',
        };
      }),
    };
  },

  // Patient Demographics — registered patients by age group and gender
  async demographics() {
    const [rows] = await pool.query('SELECT gender, date_of_birth FROM patients');
    const groups = ['0–4', '5–14', '15–24', '25–34', '35–49', '50–64', '65+'];
    const bucket = (age) => (age < 5 ? 0 : age < 15 ? 1 : age < 25 ? 2 : age < 35 ? 3 : age < 50 ? 4 : age < 65 ? 5 : 6);
    const table = groups.map((g) => ({ age_group: g, female: 0, male: 0, total: 0 }));
    rows.forEach((r) => {
      const row = table[bucket(ageFrom(r.date_of_birth))];
      if (r.gender === 'Female') row.female += 1; else row.male += 1;
      row.total += 1;
    });
    table.forEach((r) => { r.share = rows.length ? `${Math.round((r.total / rows.length) * 100)}%` : '0%'; });
    return {
      title: 'Patient Demographics',
      columns: [
        { key: 'age_group', label: 'Age group' }, { key: 'female', label: 'Female' },
        { key: 'male', label: 'Male' }, { key: 'total', label: 'Total' }, { key: 'share', label: 'Share' },
      ],
      rows: table,
    };
  },

  // Department Workloads — last 7 days up to the date
  async 'department-workloads'(date) {
    const from = shiftDate(date, -6);
    const [rows] = await pool.query(
      `SELECT dep.name AS department,
              COUNT(a.id) AS total,
              COALESCE(SUM(a.status = 'completed'), 0) AS completed,
              COALESCE(SUM(a.status = 'cancelled'), 0) AS cancelled,
              COALESCE(SUM(a.status = 'no_show'), 0) AS no_show,
              COALESCE(SUM(a.source = 'walk_in'), 0) AS walk_in
         FROM departments dep
         LEFT JOIN appointments a ON a.department_id = dep.id AND a.appt_date BETWEEN ? AND ?
        GROUP BY dep.id, dep.name ORDER BY dep.id`, [from, date]);
    return {
      title: `Department Workloads (${from} to ${date})`,
      columns: [
        { key: 'department', label: 'Department' }, { key: 'total', label: 'Appointments' },
        { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' },
        { key: 'no_show', label: 'No-shows' }, { key: 'walk_in', label: 'Walk-ins' }, { key: 'per_day', label: 'Avg / day' },
      ],
      rows: rows.map((r) => ({
        department: r.department, total: Number(r.total), completed: Number(r.completed),
        cancelled: Number(r.cancelled), no_show: Number(r.no_show), walk_in: Number(r.walk_in),
        per_day: (Number(r.total) / 7).toFixed(1),
      })),
    };
  },
};

// GET /api/reports/:type?date=YYYY-MM-DD
// Reception may only export the Daily Attendance report (Reception Use Case).
router.get('/reports/:type', authorize('admin', 'reception', 'doctor'), async (req, res, next) => {
  try {
    const fn = REPORTS[req.params.type];
    if (!fn) return res.status(404).json({ message: 'Unknown report.' });
    if (req.user.role === 'reception' && req.params.type !== 'attendance') {
      return res.status(403).json({ message: 'Reception staff can only export the Daily Attendance report.' });
    }
    const date = req.query.date || toISODate();
    const report = await fn(date, await getSettings());
    await audit(req, 'GENERATE_REPORT', `${req.params.type} ${date}`);
    res.json({ type: req.params.type, date, ...report });
  } catch (e) { next(e); }
});

module.exports = router;

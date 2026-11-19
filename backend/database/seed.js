// Fills the database with realistic demo data for Kicukiro Health Center.
// Dates are generated relative to today so the dashboard always has data.
// Usage: npm run db:seed   (or npm run db:reset to recreate tables first)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Deterministic pseudo-random numbers so every seed looks the same
let seed = 42;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const DEPARTMENTS = ['General Medicine', 'Maternity', 'Pediatrics', 'Family Planning', 'Immunization'];

const DOCTORS = [
  { name: 'Dr. Mugisha K.', email: 'dr.mugisha@kicukirohc.rw', dept: 1, specialty: 'General Practice' },
  { name: 'Dr. Uwera P.', email: 'dr.uwera@kicukirohc.rw', dept: 1, specialty: 'Internal Medicine' },
  { name: 'Dr. Ingabire A.', email: 'dr.ingabire@kicukirohc.rw', dept: 2, specialty: 'Obstetrics & Gynaecology' },
  { name: 'Dr. Mukeshimana R.', email: 'dr.mukeshimana@kicukirohc.rw', dept: 2, specialty: 'Midwifery & Antenatal Care' },
  { name: 'Dr. Nshimiyimana P.', email: 'dr.nshimiyimana@kicukirohc.rw', dept: 3, specialty: 'Paediatrics' },
  { name: 'Dr. Kayitesi J.', email: 'dr.kayitesi@kicukirohc.rw', dept: 3, specialty: 'Child Health' },
  { name: 'Dr. Umutoni C.', email: 'dr.umutoni@kicukirohc.rw', dept: 4, specialty: 'Reproductive Health' },
  { name: 'Dr. Habyarimana O.', email: 'dr.habyarimana@kicukirohc.rw', dept: 5, specialty: 'Public Health & Immunization' },
];

const FIRST = ['Aline', 'Eric', 'Grace', 'Jean', 'Claudine', 'Patrick', 'Divine', 'Olivier', 'Josiane', 'Emmanuel',
  'Solange', 'Fabrice', 'Vestine', 'Innocent', 'Chantal', 'Didier', 'Esther', 'Yves', 'Clarisse', 'Samuel',
  'Ange', 'Kevin', 'Nadine', 'Bosco', 'Liliane', 'Thierry', 'Sandrine', 'Moses', 'Gloria', 'Pacifique'];
const LAST = ['Uwimana', 'Niyonzima', 'Mukamana', 'Habimana', 'Iradukunda', 'Nkurunziza', 'Uwase', 'Mugabo',
  'Ishimwe', 'Hakizimana', 'Umutesi', 'Byiringiro', 'Ingabire', 'Ndayisaba', 'Mutoni', 'Tuyishime'];

const DIAGNOSES = {
  1: [['Mild malaria', 'Artemether-lumefantrine, 3-day course.'], ['Upper respiratory tract infection', 'Amoxicillin 500mg, 5 days.'],
    ['Hypertension follow-up', 'Amlodipine 5mg daily.'], ['Gastritis', 'Omeprazole 20mg, 14 days.'], ['Typhoid check advised', 'Lab test requested; paracetamol for fever.']],
  2: [['Antenatal visit — normal progress', 'Ferrous sulphate + folic acid daily.'], ['Mild anaemia in pregnancy', 'Iron supplements; diet counselling.'],
    ['Postnatal check — healthy', 'None.']],
  3: [['Acute diarrhoea', 'ORS and zinc, 10 days.'], ['Pneumonia (mild)', 'Amoxicillin dispersible, 5 days.'], ['Growth monitoring — normal', 'None.'],
    ['Malaria (child)', 'Artemether-lumefantrine (weight-based).']],
  4: [['Family planning counselling', 'Combined oral contraceptive started.'], ['Implant review', 'None; review in 12 months.']],
  5: [['Routine immunization', 'Measles-Rubella dose given.'], ['Routine immunization', 'Pentavalent dose 2 given.'], ['Tetanus booster', 'Td vaccine administered.']],
};
const VITALS = () => `BP ${105 + Math.floor(rand() * 30)}/${68 + Math.floor(rand() * 16)}, Temp ${(36.3 + rand() * 1.8).toFixed(1)}°C, HR ${68 + Math.floor(rand() * 24)}bpm`;

const SLOTS = [];
for (let t = 8 * 60; t + 30 <= 16 * 60; t += 30) if (t < 12 * 60 || t >= 13 * 60) SLOTS.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
// Mornings are busiest (peak 9–11, as in the dashboard figure)
const SLOT_WEIGHT = { '08:00': 3, '08:30': 4, '09:00': 7, '09:30': 7, '10:00': 7, '10:30': 7, '11:00': 5, '11:30': 5,
  '13:00': 2, '13:30': 3, '14:00': 4, '14:30': 4, '15:00': 3, '15:30': 3 };

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kicukiro_ehealth',
    dateStrings: true,
  });

  console.log('Clearing old data…');
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['backups', 'audit_logs', 'notifications', 'medical_records', 'appointments', 'doctors', 'patients', 'departments', 'users', 'settings']) {
    await db.query(`TRUNCATE TABLE ${t}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  // Settings
  const settings = [
    ['facility_name', 'Kicukiro Health Center', 'Name shown in the app and on reports'],
    ['clinic_open', '08:00', 'First consultation slot (HH:MM)'],
    ['clinic_close', '16:00', 'Clinic closing time (HH:MM)'],
    ['lunch_start', '12:00', 'Lunch break start — no slots'],
    ['lunch_end', '13:00', 'Lunch break end'],
    ['slot_minutes', '30', 'Length of one consultation slot in minutes'],
    ['booking_window_days', '14', 'How many days ahead patients can book'],
    ['attention_threshold', '12', 'Bookings per hour/department that flag "Needs attention"'],
  ];
  await db.query('INSERT INTO settings (setting_key, setting_value, description) VALUES ?', [settings]);

  // Departments
  await db.query('INSERT INTO departments (name) VALUES ?', [DEPARTMENTS.map((n) => [n])]);

  // Staff accounts
  console.log('Creating staff accounts…');
  const hash = (p) => bcrypt.hash(p, 10);
  const now = new Date();
  await db.query('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
    ['System Administrator', 'admin@kicukirohc.rw', '0788000001', await hash('Admin@123'), 'admin']);
  await db.query('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
    ['Mutesi Alice (Reception)', 'reception@kicukirohc.rw', '0788000002', await hash('Reception@123'), 'reception']);
  const doctorHash = await hash('Doctor@123');
  const doctorIds = [];
  for (const d of DOCTORS) {
    const [u] = await db.query('INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [d.name, d.email, `0788${Math.floor(100000 + rand() * 899999)}`, doctorHash, 'doctor']);
    const [doc] = await db.query('INSERT INTO doctors (user_id, department_id, specialty) VALUES (?,?,?)', [u.insertId, d.dept, d.specialty]);
    doctorIds.push({ id: doc.insertId, dept: d.dept });
  }

  // Patients — the four from the Medical Records figure, then generated ones
  console.log('Creating patients…');
  const patientHash = await hash('Patient@123');
  const patients = [];
  async function addPatient({ name, code, gender, dob, dept, email, phone, createdAt }) {
    let userId = null;
    if (email) {
      const [u] = await db.query('INSERT INTO users (full_name, email, phone, password_hash, role, created_at) VALUES (?,?,?,?,?,?)',
        [name, email, phone, patientHash, 'patient', createdAt]);
      userId = u.insertId;
    }
    const [p] = await db.query(
      `INSERT INTO patients (user_id, patient_code, full_name, gender, date_of_birth, phone, address, department_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [userId, code, name, gender, dob, phone, pick(['Kicukiro', 'Niboye', 'Gatenga', 'Kagarama', 'Gikondo', 'Kanombe']), dept, createdAt]);
    patients.push({ id: p.insertId, dept, name });
    await db.query(`INSERT INTO medical_records (patient_id, title, remarks, recorded_at) VALUES (?, 'Initial registration',
      'Patient profile created in the centralized database with baseline vitals and history intake.', ?)`, [p.insertId, createdAt]);
    return p.insertId;
  }

  const year = now.getFullYear();
  const diane = await addPatient({ name: 'Uwase Diane', code: 'KHC-00842', gender: 'Female', dob: `${year - 29}-03-11`, dept: 2,
    email: 'diane.uwase@gmail.com', phone: '0788123456', createdAt: '2026-03-19 09:00:00' });
  await addPatient({ name: 'Nkurunziza Eric', code: 'KHC-00913', gender: 'Male', dob: `${year - 41}-08-02`, dept: 1,
    email: 'eric.nkurunziza@gmail.com', phone: '0788234567', createdAt: '2026-04-02 10:30:00' });
  await addPatient({ name: 'Mukamana Grace', code: 'KHC-01022', gender: 'Female', dob: `${year - 6}-01-20`, dept: 3,
    phone: '0788345678', createdAt: '2026-05-14 11:00:00' });
  await addPatient({ name: 'Habimana Jean', code: 'KHC-00771', gender: 'Male', dob: `${year - 33}-11-05`, dept: 4,
    phone: '0788456789', createdAt: '2026-02-08 08:45:00' });

  for (let i = 0; i < 76; i += 1) {
    const dept = 1 + Math.floor(rand() * 5);
    const gender = dept === 2 || dept === 4 ? 'Female' : pick(['Female', 'Male']);
    const age = dept === 3 || dept === 5 ? Math.floor(rand() * 13) : 16 + Math.floor(rand() * 60);
    const daysAgo = i < 6 ? Math.floor(rand() * 6) : 7 + Math.floor(rand() * 300);
    const created = addDays(now, -daysAgo);
    await addPatient({
      name: `${pick(LAST)} ${pick(FIRST)}`, code: `KHC-${pad(100 + i * 9).padStart(5, '0')}`, gender,
      dob: `${year - age}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
      dept, phone: `078${Math.floor(1000000 + rand() * 8999999)}`, createdAt: `${iso(created)} 09:00:00`,
      email: i < 10 ? `patient${i + 1}@example.rw` : null,
    });
  }
  // New sign-ups get codes from KHC-01500 upwards
  await db.query('ALTER TABLE patients AUTO_INCREMENT = 1500');

  // Appointments: 14 days back to 7 days ahead, weekdays only
  console.log('Creating appointments and clinical notes…');
  const today = iso(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const weightedSlots = SLOTS.flatMap((s) => Array(SLOT_WEIGHT[s]).fill(s));
  let apptCount = 0;
  for (let offset = -14; offset <= 7; offset += 1) {
    const day = addDays(now, offset);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const date = iso(day);
    const target = offset < 0 ? 34 + Math.floor(rand() * 16) : offset === 0 ? 47 : Math.max(6, 30 - offset * 4);
    const taken = new Set();
    let made = 0; let tries = 0;
    while (made < target && tries < target * 20) {
      tries += 1;
      const doc = pick(doctorIds);
      const slot = pick(weightedSlots);
      const key = `${doc.id}|${slot}`;
      if (taken.has(key)) continue;
      const pool = patients.filter((p) => p.dept === doc.dept && p.id !== diane);
      const patient = pick(pool.length ? pool : patients);
      const [h, m] = slot.split(':').map(Number);
      const slotMin = h * 60 + m;
      let status = 'booked';
      if (date < today || (date === today && slotMin + 30 <= nowMin)) {
        const r = rand(); status = r < 0.82 ? 'completed' : r < 0.92 ? 'no_show' : 'cancelled';
      } else if (date === today && slotMin <= nowMin + 60) {
        status = rand() < 0.6 ? 'checked_in' : 'booked';
      } else if (rand() < 0.05) status = 'cancelled';
      const source = rand() < 0.2 ? 'walk_in' : 'mobile';
      const [a] = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, slot_time, status, source, reason, checked_in_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [patient.id, doc.id, doc.dept, date, slot, status, source, 'Consultation',
          ['completed', 'checked_in'].includes(status) ? `${date} ${slot}:00` : null, `${iso(addDays(day, -2))} 08:00:00`]);
      if (status !== 'cancelled') taken.add(key);
      made += 1; apptCount += 1;
      if (status === 'completed' && rand() < 0.6) {
        const [diag, rx] = pick(DIAGNOSES[doc.dept]);
        await db.query(
          `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, title, vital_signs, diagnosis, prescription, remarks, recorded_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [patient.id, doc.id, a.insertId, `Consultation — ${DEPARTMENTS[doc.dept - 1]}`, VITALS(), diag, rx,
            pick(['Vitals stable; no follow-up required unless symptoms persist.', 'Advised rest and hydration.', 'Return in 2 weeks for review.', 'Patient responded well.']),
            `${date} ${slot}:00`]);
      }
    }
  }

  // Uwase Diane's history — exactly as shown in Figure 12
  const ingabire = doctorIds.find((d) => d.dept === 2).id;
  await db.query(
    `INSERT INTO medical_records (patient_id, doctor_id, title, vital_signs, diagnosis, prescription, remarks, recorded_at) VALUES
     (?,?,?,?,?,?,?,?), (?,?,?,?,?,?,?,?)`,
    [diane, ingabire, 'Routine check-up', 'BP 116/74, Temp 36.6°C, HR 76bpm', 'No abnormalities noted.', 'None.',
      'Continue current care plan; return in 6 weeks.', '2026-05-02 09:15:00',
      diane, ingabire, 'Consultation — Maternity', 'BP 118/76, Temp 37.9°C, HR 84bpm', 'Mild malaria.',
      'Artemether-lumefantrine, 3-day course.', 'Vitals stable; no follow-up required unless symptoms persist.', '2026-06-14 10:42:00']);

  // Diane's upcoming appointment (next weekday, a slot nobody holds)
  let next = addDays(now, 2);
  while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
  for (const slot of ['14:00', '14:30', '15:00', '15:30', '13:30']) {
    try {
      await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, department_id, appt_date, slot_time, status, source, reason)
         VALUES (?,?,?,?,?,'booked','mobile','Antenatal follow-up')`, [diane, ingabire, 2, iso(next), slot]);
      await db.query(`INSERT INTO notifications (user_id, patient_id, channel, message) VALUES
        ((SELECT user_id FROM patients WHERE id = ?), ?, 'in_app', ?)`,
      [diane, diane, `Kicukiro HC: Your appointment with Dr. Ingabire A. is confirmed for ${iso(next)} at ${slot}.`]);
      break;
    } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
  }

  await db.query("INSERT INTO audit_logs (action, details) VALUES ('SEED', 'Demo data loaded')");
  await db.end();

  console.log(`✔ Seed complete: ${patients.length} patients, ${DOCTORS.length} doctors, ${apptCount} appointments.`);
  console.log('\nDemo logins:');
  console.log('  Patient    diane.uwase@gmail.com      / Patient@123   (Patient · Mobile App)');
  console.log('  Doctor     dr.mugisha@kicukirohc.rw   / Doctor@123    (Staff portal)');
  console.log('  Reception  reception@kicukirohc.rw    / Reception@123 (Staff portal)');
  console.log('  Admin      admin@kicukirohc.rw        / Admin@123     (Staff portal)');
})().catch((err) => {
  console.error('✖ Seed failed:', err);
  process.exit(1);
});

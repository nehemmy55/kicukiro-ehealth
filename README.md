# Mobile-Based E-Health Application — Kicukiro Health Center

Implementation of the project proposal *"Mobile-Based E-Health Application, Case Study: Kicukiro Health Center"*.

The stack follows the proposal (§2.1, §3.5):

| Layer     | Technology                                   | Folder      |
|-----------|----------------------------------------------|-------------|
| Frontend  | **React Native** with **Expo** (SDK 58)      | `mobile/`   |
| Backend   | **Node.js + Express**                        | `backend/`  |
| Database  | **MySQL**                                    | `backend/database/` |

The same Expo app runs on Android and iPhone through **Expo Go**, on the Android emulator / iOS simulator, and in a web browser (the "Staff · Web Portal").

---

## 1. What you need installed

1. **Node.js 20 or newer** — https://nodejs.org
2. **MySQL** — MySQL 8/9, or XAMPP/WAMP (MariaDB works too).
3. **Expo Go** app on your phone (Play Store / App Store) — *or* Android Studio's emulator.
4. Your phone and computer must be on the **same Wi-Fi network**.

---

## 2. Set up the backend (API + database)

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Open `backend/.env` and set your MySQL username and password (`DB_USER`, `DB_PASSWORD`).
With XAMPP the default is `DB_USER=root` and an empty password.

Create the tables and load the demo data:

```bash
npm run db:reset
```

Start the API:

```bash
npm start
```

You should see `✔ Kicukiro E-Health API running on http://localhost:4000/api`.
Check it in a browser: http://localhost:4000/api/health → `{"status":"ok","database":"connected"}`.

> **Windows firewall:** the first time, Windows may ask whether Node.js can use the network. Click **Allow** (private networks), otherwise the phone cannot reach the API.

---

## 3. Run the mobile app with Expo

Open a **second terminal**:

```bash
cd mobile
npm install
npx expo start
```

Then:

- **Phone:** scan the QR code with Expo Go (Android) or the Camera app (iPhone).
- **Android emulator:** press `a`.
- **iOS simulator (Mac only):** press `i`.
- **Web portal (staff dashboard):** press `w`.

The app finds the backend automatically using the same IP address as Expo. If you see *"Cannot reach the server"*, see Troubleshooting below.

---

## 4. Demo accounts

| Role          | Sign in through        | Email                        | Password       |
|---------------|------------------------|------------------------------|----------------|
| Patient       | Patient · Mobile App   | `diane.uwase@gmail.com`      | `Patient@123`  |
| Doctor        | Staff · Web Portal     | `dr.mugisha@kicukirohc.rw`   | `Doctor@123`   |
| Reception     | Staff · Web Portal     | `reception@kicukirohc.rw`    | `Reception@123`|
| Administrator | Staff · Web Portal     | `admin@kicukirohc.rw`        | `Admin@123`    |

All 8 seeded doctors use `Doctor@123`. The login screen also has "tap to fill" buttons for these accounts.
New patients can create their own account from the login screen.

---

## 5. How the code maps to the proposal

### Use cases (Chapter 4)

| Actor (Figure) | Use case | Where in the app |
|---|---|---|
| **Patient** (Fig. 6) | Register / Login | `login.js`, `register.js` |
| | Browse Departments & Doctors | Book tab → `components/BookingFlow.js` |
| | Book Appointment → Receive SMS Confirmation | Book tab; SMS + in-app notification (`backend/src/utils/helpers.js → notifyPatient`) |
| | Cancel / Reschedule Appointment | Upcoming tab |
| | View Medical History | My records tab |
| **Doctor** (Fig. 5) | View Daily Appointments | My Schedule tab |
| | Access Patient Medical History | Records tab / `patient/[id].js` |
| | Add Clinical Notes & Vitals, Prescribe Medication | "+ Add Clinical Note" modal (`ClinicalNoteModal.js`) |
| **Reception** (Fig. 7) | View Daily Appt. Queues | Queue tab |
| | Verify Patient Physical Attendance | Queue → "✓ Verify attendance" / "No-show" |
| | Register Walk-in Patients | Walk-in tab |
| | Export Daily Attendance Report | Reports tab (CSV / PDF) |
| **Administrator** (Fig. 4) | Manage System Users (Add/Remove Staff) | Users tab |
| | Manage Database Backups | System → Backups, or Dashboard → "Run cloud backup" |
| | Generate Security/Audit Logs | System → Audit logs |
| | Update System Configurations | System → Configuration |

### Interfaces (Chapter 5)

| Figure | Screen |
|---|---|
| Fig. 9 — User Authentication | `src/app/login.js` (Patient · Mobile App / Staff · Web Portal toggle) |
| Fig. 10 — Main Navigation Dashboard | `src/app/(staff)/dashboard.js` (KPIs, peak hours, department load, quick actions) |
| Fig. 11 — Appointment Booking | `src/app/(patient)/home.js` + `src/components/BookingFlow.js` |
| Fig. 12 — Medical Records Overview | `src/app/(staff)/records.js` + `src/components/PatientRecord.js` |
| Fig. 13 — Create Clinical Note Modal | `src/components/ClinicalNoteModal.js` |
| Fig. 14 — Reports & Export | `src/app/(staff)/reports.js` (4 tabs, Export CSV, Print / PDF) |

### Data Flow Diagram (Figure 3)

| DFD element | Implementation |
|---|---|
| 1.0 User Auth + D1 Users DB | `routes/auth.js`, tables `users`, `patients`, `doctors` |
| 2.0 Appt. Mgt + D2 Appts DB | `routes/appointments.js`, table `appointments` |
| 3.0 Medical Records + D3 Records DB | `routes/records.js`, table `medical_records` |

### Requirements from the text

- **No double-booking (§5.2.3):** enforced *in the database* by a unique key on doctor + date + time (`uq_no_double_booking` in `schema.sql`). Two people tapping the same slot at the same moment cannot both get it; the second sees *"Sorry, that slot was just taken"*.
- **Role-based access control (§2.1.6, §1.6):** every API route checks the user's role (`middleware/auth.js → authorize(...)`). The app also hides modules a role cannot use.
- **Encrypted tokens / secure login (§5.2.1):** passwords are hashed with bcrypt; sessions use signed JWT tokens.
- **Automated cloud backups (§1.6):** the admin can run a full JSON snapshot of all tables (saved in `backend/backups/`, ready to copy to cloud storage).
- **Automated reports (Objective iii):** Daily Attendance, Doctor Schedules, Patient Demographics, Department Workloads.
- **Out of scope (§1.4):** no Mutuelle de Santé billing integration.

---

## 6. API endpoints (for Postman testing, §3.4.1.5)

All endpoints are under `http://localhost:4000/api`. Except login/register, send the header
`Authorization: Bearer <token>` (the token comes from the login response).

| Method | Endpoint | Roles |
|---|---|---|
| POST | `/auth/login` `{email, password, portal}` | everyone |
| POST | `/auth/register` | new patients |
| GET  | `/auth/me` | signed-in |
| GET  | `/departments`, `/doctors?department_id=` | signed-in |
| GET  | `/doctors/:id/slots?date=YYYY-MM-DD` | signed-in |
| POST | `/appointments` `{doctor_id, appt_date, slot_time}` | patient, reception, admin |
| GET  | `/appointments/mine` | patient |
| GET  | `/appointments/queue?date=&department_id=` | doctor (own), reception, admin |
| PATCH| `/appointments/:id/cancel` · `/reschedule` · `/status` | see code |
| GET  | `/patients?q=` · POST `/patients/walk-in` | staff · reception |
| GET  | `/records/mine` · `/records/patient/:id` | patient · doctor, admin |
| POST/PUT | `/records` · `/records/:id` | doctor |
| GET  | `/dashboard` | staff |
| GET  | `/reports/:type?date=` (`attendance`, `doctor-schedules`, `demographics`, `department-workloads`) | admin; reception (attendance only) |
| GET/POST/PATCH/DELETE | `/admin/users…` | admin |
| GET/PUT | `/admin/settings` | admin |
| GET/POST | `/admin/backups` | admin |
| GET | `/admin/audit-logs` | admin |
| GET | `/notifications` · PATCH `/notifications/read-all` | signed-in |

---

## 7. Troubleshooting

**"Cannot reach the server at http://…:4000/api"**
1. Is the backend terminal still running `npm start`?
2. Are the phone and computer on the same Wi-Fi? (Guest/school networks sometimes block devices from talking to each other — use a phone hotspot instead.)
3. Allow Node.js through the Windows firewall.
4. Set the address by hand: copy `mobile/.env.example` to `mobile/.env`, put your computer's IP in `EXPO_PUBLIC_API_URL`, then restart with `npx expo start -c`.

**"Access denied for user" when running `npm run db:reset`** — fix `DB_USER` / `DB_PASSWORD` in `backend/.env`, and make sure MySQL is running (in XAMPP, click *Start* next to MySQL).

**Expo Go says the project needs a newer/older SDK** — this project uses Expo SDK 58. Update Expo Go from the store.

**No open slots** — after 16:00 the booking screen starts from the next working day; doctors work Monday–Friday. Clinic hours can be changed in *System → Configuration*.

**Reset all demo data** — `cd backend && npm run db:reset` (this deletes everything and reloads the demo data; dates are generated relative to today).

**SMS** — `SMS_PROVIDER=console` prints SMS messages in the backend terminal and stores them in the `notifications` table. To send real SMS, connect a gateway such as Africa's Talking inside `sendSms()` in `backend/src/utils/helpers.js`.

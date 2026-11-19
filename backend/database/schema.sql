-- =====================================================================
--  Mobile-Based E-Health Application — Kicukiro Health Center
--  MySQL database schema (Specific Objective i: securely store and
--  manage patient electronic health records and appointment schedules)
--
--  Data stores from the Data Flow Diagram (Figure 3):
--    D1: Users DB    -> users, patients, doctors
--    D2: Appts DB    -> appointments
--    D3: Records DB  -> medical_records
-- =====================================================================

CREATE DATABASE IF NOT EXISTS kicukiro_ehealth
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kicukiro_ehealth;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS backups;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS medical_records;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- D1: Users DB — one credential store for every role (RBAC, §2.1.6)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  phone          VARCHAR(20),
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('admin','doctor','reception','patient') NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at  DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE departments (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE,
  department_id  INT NOT NULL,
  specialty      VARCHAR(100) NOT NULL,
  -- comma-separated ISO weekdays the doctor consults (1=Mon … 7=Sun)
  working_days   VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5',
  CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_dept FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- A patient profile may belong to a mobile-app account (user_id) or be a
-- walk-in registered by reception staff without an account (user_id NULL).
CREATE TABLE patients (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NULL UNIQUE,
  patient_code   VARCHAR(40) NOT NULL UNIQUE,      -- e.g. KHC-00842
  full_name      VARCHAR(120) NOT NULL,
  gender         ENUM('Female','Male') NOT NULL,
  date_of_birth  DATE NOT NULL,
  phone          VARCHAR(20),
  address        VARCHAR(150),
  department_id  INT NULL,                          -- main department of care
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pat_dept FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- D2: Appts DB
-- The generated column `active_slot` is 1 for any live booking and NULL
-- for cancelled ones. The UNIQUE key on (doctor, date, time, active_slot)
-- makes double-booking impossible at the database layer (§5.2.3), while
-- still letting a cancelled slot be booked again.
-- ---------------------------------------------------------------------
CREATE TABLE appointments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT NOT NULL,
  doctor_id      INT NOT NULL,
  department_id  INT NOT NULL,
  appt_date      DATE NOT NULL,
  slot_time      TIME NOT NULL,
  status         ENUM('booked','checked_in','completed','cancelled','no_show')
                   NOT NULL DEFAULT 'booked',
  source         ENUM('mobile','walk_in') NOT NULL DEFAULT 'mobile',
  reason         VARCHAR(255),
  checked_in_at  DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active_slot    TINYINT GENERATED ALWAYS AS (IF(status = 'cancelled', NULL, 1)) STORED,
  CONSTRAINT fk_app_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors(id),
  CONSTRAINT fk_app_dept    FOREIGN KEY (department_id) REFERENCES departments(id),
  UNIQUE KEY uq_no_double_booking (doctor_id, appt_date, slot_time, active_slot),
  KEY idx_app_date (appt_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- D3: Records DB — clinical notes, vitals, diagnoses, prescriptions
-- ---------------------------------------------------------------------
CREATE TABLE medical_records (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  doctor_id       INT NULL,
  appointment_id  INT NULL,
  title           VARCHAR(120) NOT NULL,
  vital_signs     VARCHAR(255),
  diagnosis       VARCHAR(255),
  prescription    TEXT,
  remarks         TEXT,
  recorded_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- secure timestamp
  CONSTRAINT fk_rec_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors(id) ON DELETE SET NULL,
  CONSTRAINT fk_rec_appt    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  KEY idx_rec_patient (patient_id, recorded_at)
) ENGINE=InnoDB;

-- Booking confirmations (in-app + SMS, Patient Use Case "Receive SMS Confirmation")
CREATE TABLE notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  patient_id  INT NULL,
  channel     ENUM('in_app','sms') NOT NULL,
  recipient   VARCHAR(150),
  message     VARCHAR(500) NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_not_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Administrator Use Case: "Generate Security/Audit Logs"
CREATE TABLE audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  user_role   VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  details     VARCHAR(500),
  ip_address  VARCHAR(60),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_time (created_at)
) ENGINE=InnoDB;

-- Administrator Use Case: "Manage Database Backups" (§1.6 risk mitigation)
CREATE TABLE backups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  file_name   VARCHAR(200) NOT NULL,
  size_bytes  INT NOT NULL,
  row_count   INT NOT NULL,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Administrator Use Case: "Update System Configurations"
CREATE TABLE settings (
  setting_key    VARCHAR(60) PRIMARY KEY,
  setting_value  VARCHAR(255) NOT NULL,
  description    VARCHAR(255)
) ENGINE=InnoDB;

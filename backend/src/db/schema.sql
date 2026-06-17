-- TMS Database Schema
-- Run: psql -U postgres -d tms -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(200) UNIQUE NOT NULL,
  password    VARCHAR(200) NOT NULL,
  role        VARCHAR(20)  NOT NULL CHECK (role IN ('admin','operator','qc')),
  active      BOOLEAN DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  code        VARCHAR(100),
  description TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ROTORS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rotors (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER REFERENCES projects(id),
  serial_no   VARCHAR(50) UNIQUE NOT NULL,  -- SAM-RT-0001
  shaft_no    VARCHAR(50),                   -- 25-58053
  rotor_type  VARCHAR(50) DEFAULT 'DKCBZ 0210-4',
  status      VARCHAR(30) DEFAULT 'not_started'
              CHECK (status IN ('not_started','in_progress','qc_pending','completed','assembled')),
  photo_count INTEGER DEFAULT 0,
  notes       TEXT,
  assembled_at TIMESTAMPTZ,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STEP STATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS step_states (
  id            SERIAL PRIMARY KEY,
  rotor_id      INTEGER REFERENCES rotors(id) ON DELETE CASCADE,
  section       VARCHAR(20) NOT NULL CHECK (section IN ('stacking','brazing')),
  step_number   INTEGER NOT NULL,
  status        VARCHAR(20) DEFAULT 'not_started'
                CHECK (status IN ('not_started','in_progress','paused','qc_pending','completed','failed_oot','rejected')),
  started_by    INTEGER REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  paused_at     TIMESTAMPTZ,
  completed_by  INTEGER REFERENCES users(id),
  completed_at  TIMESTAMPTZ,
  duration_min  INTEGER,                    -- minutes
  qc_by         INTEGER REFERENCES users(id),
  qc_at         TIMESTAMPTZ,
  note          TEXT,
  oot           BOOLEAN DEFAULT false,
  oot_reason    TEXT,
  rejected      BOOLEAN DEFAULT false,
  reject_note   TEXT,
  UNIQUE (rotor_id, section, step_number)
);

-- ─────────────────────────────────────────────
-- MEASUREMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurements (
  id            SERIAL PRIMARY KEY,
  step_state_id INTEGER REFERENCES step_states(id) ON DELETE CASCADE,
  meas_index    INTEGER NOT NULL,
  field_label   VARCHAR(100),
  nominal       NUMERIC(10,4),
  tol_plus      NUMERIC(10,4),
  tol_minus     NUMERIC(10,4),
  actual_value  NUMERIC(10,4),
  unit          VARCHAR(20),
  in_tolerance  BOOLEAN,
  is_min_check  BOOLEAN DEFAULT false,
  equipment     VARCHAR(100),
  recorded_by   INTEGER REFERENCES users(id),
  recorded_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (step_state_id, meas_index)
);

-- ─────────────────────────────────────────────
-- PHOTOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id          SERIAL PRIMARY KEY,
  rotor_id    INTEGER REFERENCES rotors(id) ON DELETE CASCADE,
  filename    VARCHAR(300),
  filepath    VARCHAR(500),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ROTOR PARTS (assembly traceability)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rotor_parts (
  id          SERIAL PRIMARY KEY,
  rotor_id    INTEGER REFERENCES rotors(id) ON DELETE CASCADE UNIQUE,
  shaft_sn    VARCHAR(100),
  stator_sn   VARCHAR(100),
  bearing_bracket_sn VARCHAR(100),
  bearing_de_sn      VARCHAR(100),
  bearing_nde_sn     VARCHAR(100),
  tooth_wheel_sn     VARCHAR(100),
  coupling_sn        VARCHAR(100),
  assembly_note TEXT,
  assembled_by INTEGER REFERENCES users(id),
  assembled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- OOT RECORDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oot_records (
  id            SERIAL PRIMARY KEY,
  rotor_id      INTEGER REFERENCES rotors(id),
  step_state_id INTEGER REFERENCES step_states(id),
  section       VARCHAR(20),
  step_number   INTEGER,
  details       TEXT,
  reason        TEXT,
  action        VARCHAR(20),
  resolved      BOOLEAN DEFAULT false,
  recorded_by   INTEGER REFERENCES users(id),
  recorded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  user_name   VARCHAR(120),
  action      VARCHAR(80),
  rotor_id    INTEGER,
  rotor_sn    VARCHAR(50),
  section     VARCHAR(20),
  step_number INTEGER,
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  type        VARCHAR(40),
  message     TEXT,
  rotor_id    INTEGER,
  target_role VARCHAR(20),  -- 'qc', 'admin', or null for all
  unread      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SHIFT HANDOVERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_handovers (
  id            SERIAL PRIMARY KEY,
  out_user_id   INTEGER REFERENCES users(id),
  in_user_id    INTEGER REFERENCES users(id),
  note          TEXT,
  active_steps  JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rotors_project    ON rotors(project_id);
CREATE INDEX IF NOT EXISTS idx_rotors_status     ON rotors(status);
CREATE INDEX IF NOT EXISTS idx_step_states_rotor ON step_states(rotor_id);
CREATE INDEX IF NOT EXISTS idx_measurements_step ON measurements(step_state_id);
CREATE INDEX IF NOT EXISTS idx_audit_rotor       ON audit_log(rotor_id);
CREATE INDEX IF NOT EXISTS idx_notif_role        ON notifications(target_role, unread);

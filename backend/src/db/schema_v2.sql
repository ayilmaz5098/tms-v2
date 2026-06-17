-- TMS Schema V2 additions
-- Run: node src/db/migrate_v2.js

-- ─── Add step_number + section to photos (per-step photos) ───
ALTER TABLE photos ADD COLUMN IF NOT EXISTS section VARCHAR(20);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS step_number INTEGER;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS step_name VARCHAR(200);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_data TEXT; -- base64 for in-db storage (admin/qc viewing)

-- ─── Documents (BOM List + Instructions) ───
CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER REFERENCES projects(id),
  category     VARCHAR(40) NOT NULL CHECK (category IN ('bom','instruction','drawing','other')),
  title        VARCHAR(300) NOT NULL,
  url          TEXT,        -- Google Drive / external link
  filepath     VARCHAR(500), -- uploaded file path
  uploaded_by  INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Motors (final assembled product) ───
CREATE TABLE IF NOT EXISTS motors (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER REFERENCES projects(id),
  motor_sn     VARCHAR(100) UNIQUE NOT NULL,  -- motor serial number
  rotor_id     INTEGER REFERENCES rotors(id), -- which rotor went in
  status       VARCHAR(30) DEFAULT 'assembly_pending',
  notes        TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Motor parts (serial numbers of all components) ───
CREATE TABLE IF NOT EXISTS motor_parts (
  id               SERIAL PRIMARY KEY,
  motor_id         INTEGER REFERENCES motors(id) ON DELETE CASCADE,
  part_name        VARCHAR(100),
  serial_number    VARCHAR(100),
  entered_by       INTEGER REFERENCES users(id),
  entered_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Partial assembly tracking (rotor_parts now supports partial saves) ───
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS last_updated_by INTEGER REFERENCES users(id);
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── QC measurement edits ───
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS original_value NUMERIC(10,4);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_photos_rotor_step ON photos(rotor_id, section, step_number);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id, category);
CREATE INDEX IF NOT EXISTS idx_motors_project    ON motors(project_id);
CREATE INDEX IF NOT EXISTS idx_motor_parts_motor ON motor_parts(motor_id);

-- Update section column to allow new section names
ALTER TABLE step_states DROP CONSTRAINT IF EXISTS step_states_section_check;
ALTER TABLE step_states ADD CONSTRAINT step_states_section_check
  CHECK (section IN ('stacking','brazing','brazing_oncesi','brazing_sonrasi','boyama'));
-- Keep old values for existing data, new data uses new names

-- QC requirement override per step (admin can toggle)
ALTER TABLE step_states ADD COLUMN IF NOT EXISTS qc_required BOOLEAN DEFAULT NULL;

-- Materials list per step (admin sets, operators can view)
CREATE TABLE IF NOT EXISTS step_materials (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,
  step_number INT  NOT NULL,
  material    TEXT NOT NULL,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, step_number, material)
);

-- ─── MOTOR TESTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motor_tests (
  id          SERIAL PRIMARY KEY,
  motor_id    INTEGER REFERENCES motors(id) ON DELETE CASCADE,
  step_code   VARCHAR(20) NOT NULL,   -- e.g. 'EZ01', 'EA08', 'EA16'
  status      VARCHAR(20) DEFAULT 'not_started', -- not_started|in_progress|completed
  data        JSONB DEFAULT '{}',     -- flexible: all inputs stored as JSON
  started_by  INTEGER REFERENCES users(id),
  started_at  TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  UNIQUE(motor_id, step_code)
);
CREATE INDEX IF NOT EXISTS idx_motor_tests_motor ON motor_tests(motor_id);

-- Admin-managed technical drawing links per step
CREATE TABLE IF NOT EXISTS step_drawings (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,
  step_number INT  NOT NULL,
  label       TEXT NOT NULL,          -- e.g. "CK.13713.88" or custom name
  url         TEXT NOT NULL,          -- Google Drive or any URL
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_step_drawings_step ON step_drawings(section, step_number);

-- Admin-managed equipment list per step
CREATE TABLE IF NOT EXISTS step_equipment (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,
  step_number INT  NOT NULL,
  name        TEXT NOT NULL,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_step_equipment_step ON step_equipment(section, step_number);

-- Admin-overridable tolerance per measurement index
CREATE TABLE IF NOT EXISTS step_tolerances (
  id          SERIAL PRIMARY KEY,
  section     TEXT NOT NULL,
  step_number INT  NOT NULL,
  meas_index  INT  NOT NULL,
  label       TEXT,
  nominal     NUMERIC,
  tol_plus    NUMERIC,
  tol_minus   NUMERIC,
  unit        TEXT,
  is_min      BOOLEAN DEFAULT false,
  created_by  INT REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, step_number, meas_index)
);

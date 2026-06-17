-- V4: Project-wide QC mode + project-scoped tolerances for motor tests

-- #14: Project-level QC mode toggle
ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_mode BOOLEAN DEFAULT true;

-- #16: Project-scoped motor test tolerances (JSON override map)
-- Shape: { "STEP_CODE": { "field_key": { "type": "min|max|range", "value": X, "min": Y, "max": Z, "label": "..." } } }
ALTER TABLE projects ADD COLUMN IF NOT EXISTS motor_tolerances JSONB DEFAULT NULL;

-- #16: Add project_id to step_tolerances for project-scoped rotor tolerances
ALTER TABLE step_tolerances ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_step_tolerances_project ON step_tolerances(project_id, section, step_number, meas_index);

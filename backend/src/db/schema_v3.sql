-- V3: Admin date/name override columns + missing rotor_parts columns
-- All statements use IF NOT EXISTS — safe to run on production and staging

-- Admin override fields for retroactive/historical entries
ALTER TABLE step_states ADD COLUMN IF NOT EXISTS operator_name_override VARCHAR(200);
ALTER TABLE motor_tests ADD COLUMN IF NOT EXISTS operator_name_override VARCHAR(200);

-- These rotor_parts columns exist on production but were never in a migration file.
-- Adding them here so staging (and any future server) gets them automatically.
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS fan_sn         VARCHAR(100);
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS kaplin_sn      VARCHAR(100);
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS enkoder_sn     VARCHAR(100);
ALTER TABLE rotor_parts ADD COLUMN IF NOT EXISTS field_timestamps JSONB DEFAULT '{}';

-- Admin override fields for motor_parts (retroactive date/name editing)
ALTER TABLE motor_parts ADD COLUMN IF NOT EXISTS entered_at_override TIMESTAMPTZ;
ALTER TABLE motor_parts ADD COLUMN IF NOT EXISTS entered_by_name_override VARCHAR(200);

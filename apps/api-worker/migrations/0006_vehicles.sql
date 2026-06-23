-- ============================================================
-- Migration: 0006_vehicles
-- Smart Household Tracker – Vehicle Tracker Module
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id     TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  nickname         TEXT NOT NULL,
  make             TEXT,
  model            TEXT,
  year             INTEGER,
  reg_number       TEXT,
  fuel_type        TEXT DEFAULT 'petrol' CHECK(fuel_type IN ('petrol','diesel','cng','electric','hybrid')),
  color            TEXT,
  insurance_expiry TEXT,   -- YYYY-MM-DD
  puc_expiry       TEXT,   -- YYYY-MM-DD
  last_service     TEXT,   -- YYYY-MM-DD
  next_service     TEXT,   -- YYYY-MM-DD
  notes            TEXT,
  created_by       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_vehicles_household ON vehicles(household_id, deleted_at);

-- Service / maintenance log per vehicle
CREATE TABLE IF NOT EXISTS vehicle_services (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  vehicle_id   TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK(service_type IN ('regular','repair','insurance_renewal','puc','tyre','other')),
  odometer     INTEGER,
  cost         REAL,
  provider     TEXT,
  notes        TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vehicle_services_vehicle ON vehicle_services(vehicle_id, service_date DESC);


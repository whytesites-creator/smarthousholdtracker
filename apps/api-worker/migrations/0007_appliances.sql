-- ============================================================
-- Migration: 0007_appliances
-- Smart Household Tracker – Appliance Tracker Module
-- ============================================================

CREATE TABLE IF NOT EXISTS appliances (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK(category IN (
                    'ac','refrigerator','washing_machine','tv','microwave',
                    'water_purifier','geyser','fan','mixer','laptop','phone','other'
                  )),
  brand           TEXT,
  model           TEXT,
  serial_no       TEXT,
  purchase_date   TEXT,     -- YYYY-MM-DD
  warranty_expiry TEXT,     -- YYYY-MM-DD
  purchase_price  REAL,
  shop            TEXT,
  notes           TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_appliances_household ON appliances(household_id, deleted_at);

-- Service / repair log per appliance
CREATE TABLE IF NOT EXISTS appliance_services (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  appliance_id TEXT NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  service_date TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK(service_type IN ('repair','maintenance','installation','warranty_claim','other')),
  cost         REAL,
  provider     TEXT,
  notes        TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appliance_services_appliance ON appliance_services(appliance_id, service_date DESC);


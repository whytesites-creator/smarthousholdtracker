-- ============================================================
-- Migration: 0004_gas_water
-- Smart Household Tracker – Gas Cylinder + Water Can Modules
-- ============================================================

-- ── Gas Cylinder ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gas_entries (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  refill_date   TEXT NOT NULL,          -- ISO date YYYY-MM-DD
  vendor        TEXT,
  price         REAL,
  cylinder_type TEXT NOT NULL DEFAULT 'domestic' CHECK(cylinder_type IN ('domestic','commercial','auto')),
  notes         TEXT,
  created_by    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gas_household ON gas_entries(household_id, refill_date DESC);

-- ── Water Can ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_deliveries (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  vendor        TEXT,
  qty           REAL NOT NULL CHECK(qty > 0),
  unit          TEXT NOT NULL DEFAULT 'cans' CHECK(unit IN ('cans','L')),
  cost          REAL,
  delivery_date TEXT NOT NULL,          -- ISO date YYYY-MM-DD
  notes         TEXT,
  created_by    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_water_household ON water_deliveries(household_id, delivery_date DESC);


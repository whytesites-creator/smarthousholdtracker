-- ============================================================
-- Migration: 0003_inventory
-- Smart Household Tracker – Grocery Inventory Module
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL CHECK(unit IN ('kg','g','L','ml','count','dozen','pack')),
  current_qty    REAL NOT NULL DEFAULT 0 CHECK(current_qty >= 0),
  min_threshold  REAL NOT NULL DEFAULT 0 CHECK(min_threshold >= 0),
  is_custom      INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_household
  ON inventory_items(household_id, is_active);

-- ── Transactions (every stock movement is logged) ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id      TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK(type IN ('purchase','consume','adjust','waste')),
  qty          REAL NOT NULL,               -- positive = in, negative = out
  unit_price   REAL,                        -- cost per unit (optional)
  total_price  REAL,                        -- total cost (optional)
  note         TEXT,
  txn_date     TEXT NOT NULL DEFAULT (date('now')),
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_item
  ON inventory_transactions(item_id, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_inv_txn_household
  ON inventory_transactions(household_id, txn_date DESC);


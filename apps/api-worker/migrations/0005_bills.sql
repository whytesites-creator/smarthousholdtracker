-- ============================================================
-- Migration: 0005_bills
-- Smart Household Tracker – Bill Manager Module
-- ============================================================

-- Bill definitions (recurring or one-time)
CREATE TABLE IF NOT EXISTS bills (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK(type IN (
                   'electricity','internet','mobile','water_tax','property_tax',
                   'dth','subscription','other'
                 )),
  provider       TEXT,
  amount         REAL,                  -- expected amount (can vary)
  recurrence     TEXT NOT NULL DEFAULT 'monthly' CHECK(recurrence IN (
                   'monthly','quarterly','yearly','one_time'
                 )),
  due_day        INTEGER,               -- day of month (1-28) for monthly bills
  active         INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bills_household ON bills(household_id, active);

-- Bill instances (each due occurrence)
CREATE TABLE IF NOT EXISTS bill_instances (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bill_id      TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  due_date     TEXT NOT NULL,           -- YYYY-MM-DD
  amount_due   REAL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue','skipped')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_instances_household ON bill_instances(household_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_bill_instances_bill      ON bill_instances(bill_id, due_date DESC);

-- Payments
CREATE TABLE IF NOT EXISTS bill_payments (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  instance_id    TEXT NOT NULL REFERENCES bill_instances(id) ON DELETE CASCADE,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  paid_on        TEXT NOT NULL,
  amount_paid    REAL NOT NULL,
  mode           TEXT DEFAULT 'online' CHECK(mode IN ('cash','online','cheque','auto_debit','upi')),
  reference      TEXT,
  paid_by        TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_instance ON bill_payments(instance_id);


-- ============================================================
-- Migration: 0002_expenses
-- Smart Household Tracker – Expenses Module
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK(category IN (
                 'groceries','milk','vegetables','gas','electricity','internet',
                 'education','medical','transport','shopping','miscellaneous'
               )),
  amount       REAL NOT NULL CHECK(amount > 0),
  note         TEXT,
  spent_on     TEXT NOT NULL DEFAULT (date('now')),   -- ISO date YYYY-MM-DD
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT                                   -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_expenses_household_spent
  ON expenses(household_id, spent_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_household_category
  ON expenses(household_id, category)
  WHERE deleted_at IS NULL;


-- ============================================================
-- Migration: 0010_notifications
-- Smart Household Tracker – Notifications Module
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK(type IN (
                 'bill_due','vehicle_expiry','appliance_warranty',
                 'health_reminder','inventory_low','document_expiry','general'
               )),
  title        TEXT NOT NULL,
  body         TEXT,
  entity_type  TEXT,   -- 'bill' | 'vehicle' | 'appliance' | 'health' | 'document'
  entity_id    TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_household ON notifications(household_id, created_at DESC);


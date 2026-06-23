-- ============================================================
-- Migration: 0008_health
-- Smart Household Tracker – Health Reminders Module
-- ============================================================

-- Family members for health tracking
CREATE TABLE IF NOT EXISTS health_members (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  dob          TEXT,   -- YYYY-MM-DD
  relation     TEXT NOT NULL CHECK(relation IN (
                 'self','spouse','child','parent','grandparent','sibling','other'
               )),
  blood_group  TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_members_household ON health_members(household_id);

-- Health reminders (medicine schedules, vaccines, checkups)
CREATE TABLE IF NOT EXISTS health_reminders (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id    TEXT REFERENCES health_members(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK(type IN ('medicine','vaccine','doctor','checkup','other')),
  title        TEXT NOT NULL,
  due_date     TEXT NOT NULL,   -- YYYY-MM-DD
  recurrence   TEXT DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly','yearly')),
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','skipped')),
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_reminders_household ON health_reminders(household_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_health_reminders_member ON health_reminders(member_id, due_date);


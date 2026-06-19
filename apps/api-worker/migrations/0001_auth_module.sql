-- ============================================================
-- Migration: 0001_auth_module
-- Smart Household Tracker – Authentication Module
-- ============================================================

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  supabase_user_id TEXT NOT NULL UNIQUE,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  phone            TEXT,
  timezone         TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Households ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency    TEXT NOT NULL DEFAULT 'INR',
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_households_created_by ON households(created_by);

-- ─── Household Memberships ────────────────────────────────────
CREATE TABLE IF NOT EXISTS household_memberships (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK(role IN ('owner','admin','member','viewer')) DEFAULT 'member',
  status       TEXT NOT NULL CHECK(status IN ('active','invited','suspended')) DEFAULT 'active',
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_household ON household_memberships(household_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON household_memberships(user_id);

-- ─── Invites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invited_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('admin','member','viewer')) DEFAULT 'member',
  token        TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(32)))),
  status       TEXT NOT NULL CHECK(status IN ('pending','accepted','expired','revoked')) DEFAULT 'pending',
  expires_at   TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
  accepted_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_household ON invites(household_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ─── Sessions Audit ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions_audit (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event      TEXT NOT NULL CHECK(event IN ('login','logout','register','password_reset','password_change','invite_accepted')),
  ip_address TEXT,
  user_agent TEXT,
  metadata   TEXT, -- JSON blob for extra context
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_audit_user ON sessions_audit(user_id, created_at DESC);

-- ─── Audit Logs (generic) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id   TEXT REFERENCES households(id) ON DELETE SET NULL,
  actor_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  before_json    TEXT,
  after_json     TEXT,
  at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_household ON audit_logs(household_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);


-- ============================================================
-- Migration: 0009_documents
-- Smart Household Tracker – Document Vault Module
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL CHECK(category IN (
                 'aadhaar','pan','passport','voter_id','driving_license',
                 'insurance','property','vehicle','medical','other'
               )),
  member_name  TEXT,
  doc_number   TEXT,
  issue_date   TEXT,     -- YYYY-MM-DD
  expiry_date  TEXT,     -- YYYY-MM-DD
  file_url     TEXT,     -- Supabase Storage URL
  notes        TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_household ON documents(household_id, category, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(household_id, expiry_date) WHERE deleted_at IS NULL;


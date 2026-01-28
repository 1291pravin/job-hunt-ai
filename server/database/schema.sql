-- Job Search Automation Database Schema

-- Job listings
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  salary TEXT,
  experience TEXT,
  description TEXT,
  requirements TEXT,
  email TEXT,
  apply_url TEXT,
  posted_at TEXT,
  scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
  match_score INTEGER,
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'matched', 'interested', 'applied', 'archived', 'rejected', 'ignored')),
  notes TEXT
);

-- Migration: Add experience column if missing (for existing databases)
-- SQLite doesn't support IF NOT EXISTS for columns, so we handle via pragma
-- The app code should handle this gracefully

-- Application tracking (simple - just track when applied)
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- User settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_url ON jobs(url);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC);

-- Default settings (example values - customize in Settings page after resume upload)
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('keywords', '["Vue.js", "Nuxt", "Full Stack", "Frontend", "TypeScript"]'),
  ('enabled_sources', '["naukri", "linkedin"]'),
  ('pages_to_scrape', '3');

import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

let db: Database.Database | null = null

// Get project root using process.cwd() which works in Nitro
function getProjectRoot(): string {
  return process.cwd()
}

export function getDatabase(): Database.Database {
  if (db) return db

  const config = useRuntimeConfig()
  const dbPath = config.databasePath || './data/jobs.db'

  const projectRoot = getProjectRoot()
  const absoluteDbPath = join(projectRoot, dbPath)
  const dbDir = dirname(absoluteDbPath)

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  console.log(`[Database] Connecting to: ${absoluteDbPath}`)
  db = new Database(absoluteDbPath)
  db.pragma('foreign_keys = ON')

  initializeSchema(db)
  return db
}

function initializeSchema(database: Database.Database): void {
  // Use process.cwd() to find schema file in server/database/
  const schemaPath = join(getProjectRoot(), 'server', 'database', 'schema.sql')

  try {
    const schema = readFileSync(schemaPath, 'utf-8')
    database.exec(schema)
    console.log('[Database] Schema initialized')

    // Run migrations for existing databases
    runMigrations(database)
  } catch (error) {
    console.error('[Database] Schema error:', error)
    throw error
  }
}

function runMigrations(database: Database.Database): void {
  // Check and add experience column if missing
  const columns = database.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]
  const hasExperience = columns.some(col => col.name === 'experience')

  if (!hasExperience) {
    console.log('[Database] Adding experience column...')
    database.exec('ALTER TABLE jobs ADD COLUMN experience TEXT')
  }

  // Migration: Update status CHECK constraint to include 'matched'
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  migrateStatusConstraint(database)

  console.log('[Database] Migrations complete')
}

function migrateStatusConstraint(database: Database.Database): void {
  // Check if migration already done by testing if we can set 'archived' status
  try {
    database.exec("INSERT INTO jobs (source, url, title, status) VALUES ('_test', '_test_url_migration_check', '_test', 'archived')")
    database.exec("DELETE FROM jobs WHERE source = '_test'")
    // If we get here, the constraint already supports all statuses
    return
  } catch {
    // Constraint doesn't support new statuses, need to migrate
  }

  console.log('[Database] Migrating jobs table to support new status values...')

  database.exec('BEGIN TRANSACTION')
  try {
    // Create new table with updated constraint
    database.exec(`
      CREATE TABLE jobs_new (
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
      )
    `)

    // Copy data
    database.exec(`
      INSERT INTO jobs_new (id, source, external_id, url, title, company, location, salary, experience,
        description, requirements, email, apply_url, posted_at, scraped_at, match_score, status, notes)
      SELECT id, source, external_id, url, title, company, location, salary, experience,
        description, requirements, email, apply_url, posted_at, scraped_at, match_score, status, notes
      FROM jobs
    `)

    // Drop old table and rename
    database.exec('DROP TABLE jobs')
    database.exec('ALTER TABLE jobs_new RENAME TO jobs')

    // Recreate indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)')
    database.exec('CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source)')
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_url ON jobs(url)')
    database.exec('CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC)')

    database.exec('COMMIT')
    console.log('[Database] Migration complete - jobs table now supports all statuses')
  } catch (error) {
    database.exec('ROLLBACK')
    console.error('[Database] Migration failed:', error)
    throw error
  }
}

// Types
export interface JobRow {
  id: number
  source: string
  external_id: string | null
  url: string
  title: string
  company: string | null
  location: string | null
  salary: string | null
  experience: string | null
  description: string | null
  requirements: string | null
  email: string | null
  apply_url: string | null
  posted_at: string | null
  scraped_at: string
  match_score: number | null
  status: string
  notes: string | null
}

// Job CRUD
export function getAllJobs(filters?: {
  status?: string
  source?: string
  search?: string
  page?: number
  perPage?: number
  sort?: string
}): { jobs: JobRow[]; total: number } {
  const database = getDatabase()
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters?.status && filters.status !== 'all') {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  if (filters?.source && filters.source !== 'all') {
    conditions.push('source = ?')
    params.push(filters.source)
  }

  if (filters?.search) {
    conditions.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)')
    const term = `%${filters.search}%`
    params.push(term, term, term)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countStmt = database.prepare(`SELECT COUNT(*) as count FROM jobs ${whereClause}`)
  const { count: total } = countStmt.get(...params) as { count: number }

  const page = filters?.page || 1
  const perPage = filters?.perPage || 20
  const offset = (page - 1) * perPage

  // Determine sort order
  let orderBy = 'scraped_at DESC'
  if (filters?.sort === 'score') {
    orderBy = 'match_score DESC NULLS LAST, scraped_at DESC'
  } else if (filters?.sort === 'score_asc') {
    orderBy = 'match_score ASC NULLS LAST, scraped_at DESC'
  }

  const selectStmt = database.prepare(`
    SELECT * FROM jobs ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `)

  const jobs = selectStmt.all(...params, perPage, offset) as JobRow[]
  return { jobs, total }
}

export function getJobById(id: number): JobRow | null {
  const database = getDatabase()
  return database.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | null
}

export function createJob(job: Omit<JobRow, 'id' | 'scraped_at'>): number {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO jobs (source, external_id, url, title, company, location, salary, experience,
      description, requirements, email, apply_url, posted_at, match_score, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    job.source, job.external_id, job.url, job.title, job.company,
    job.location, job.salary, job.experience, job.description, job.requirements,
    job.email, job.apply_url, job.posted_at, job.match_score,
    job.status || 'new', job.notes
  )
  return result.lastInsertRowid as number
}

export function updateJob(id: number, updates: Partial<JobRow>): boolean {
  const database = getDatabase()
  const fields: string[] = []
  const values: (string | number | null)[] = []

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'scraped_at') {
      fields.push(`${key} = ?`)
      values.push(value as string | number | null)
    }
  }

  if (fields.length === 0) return false

  values.push(id)
  const result = database.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function deleteJob(id: number): boolean {
  const database = getDatabase()
  return database.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0
}

export function jobExists(url: string): boolean {
  const database = getDatabase()
  return database.prepare('SELECT 1 FROM jobs WHERE url = ?').get(url) !== undefined
}

// Settings
export function getSetting(key: string): string | null {
  const database = getDatabase()
  const result = database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return result?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const database = getDatabase()
  database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const database = getDatabase()
  const rows = database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// Applications (simple tracking)
export function createApplication(jobId: number): number {
  const database = getDatabase()
  const result = database.prepare(`
    INSERT INTO applications (job_id) VALUES (?)
  `).run(jobId)
  return result.lastInsertRowid as number
}

export function getApplicationsByJobId(jobId: number) {
  const database = getDatabase()
  return database.prepare('SELECT * FROM applications WHERE job_id = ? ORDER BY sent_at DESC').all(jobId)
}

// Stats
export function getJobStats() {
  const database = getDatabase()

  const statusStats = database.prepare('SELECT status, COUNT(*) as count FROM jobs GROUP BY status')
    .all() as { status: string; count: number }[]

  const sourceStats = database.prepare('SELECT source, COUNT(*) as count FROM jobs GROUP BY source')
    .all() as { source: string; count: number }[]

  const { count: total } = database.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }

  return {
    total,
    byStatus: Object.fromEntries(statusStats.map(s => [s.status, s.count])),
    bySource: Object.fromEntries(sourceStats.map(s => [s.source, s.count]))
  }
}

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Build & Preview
npm run build        # Build for production
npm run preview      # Preview production build

# Scraping (via API)
# POST /api/scrape with body: { sources: string[], keywords: string[], maxPages: number }
```

## Architecture

This is a **Nuxt 4** job portal application for scraping, tracking, and managing job listings. It uses:
- **Frontend**: Vue 3 + Tailwind CSS 4 + TypeScript
- **Backend**: Nitro server with file-based API routes
- **Database**: SQLite via better-sqlite3 (stored at `./data/jobs.db`)
- **Scraping**: Playwright for headless browser automation

### Key Directories

```
server/
├── api/                    # Nitro API routes (REST endpoints)
│   ├── jobs.get.ts         # GET /api/jobs (list with filters/pagination)
│   ├── jobs.post.ts        # POST /api/jobs (create job)
│   ├── jobs/[id].*.ts      # GET/PATCH/DELETE /api/jobs/:id
│   ├── settings.*.ts       # GET/POST /api/settings
│   └── scrape.post.ts      # POST /api/scrape (trigger scraping)
├── database/
│   ├── index.ts            # Database singleton, CRUD operations, migrations
│   └── schema.sql          # SQLite schema (jobs, applications, settings tables)
└── scraper/
    ├── index.ts            # Scraper orchestrator (runScraper function)
    ├── sites/
    │   ├── base.ts         # BaseScraper abstract class
    │   ├── remoteok.ts     # RemoteOK scraper
    │   ├── weworkremotely.ts
    │   └── naukri.ts
    └── utils/browser.ts    # Playwright browser management

app/
├── pages/
│   ├── index.vue           # Job listings dashboard with filters/stats
│   ├── jobs/[id].vue       # Individual job detail page
│   └── settings.vue        # Scraper configuration
└── layouts/default.vue     # App shell layout

types/index.ts              # Zod schemas and TypeScript types for Job, Application
```

### Data Flow

1. **Scraping**: `POST /api/scrape` → `runScraper()` → Site-specific scrapers extend `BaseScraper` → Jobs saved to SQLite
2. **Job Management**: Frontend calls REST APIs → `server/database/index.ts` handles all DB operations
3. **Job Status Workflow**: `new` → `interested` → `applied` → `rejected`/`ignored`

### Adding a New Scraper

1. Create `server/scraper/sites/newsite.ts` extending `BaseScraper`
2. Implement required methods: `getJobListSelector()`, `buildSearchUrl()`, `parseJobCard()`
3. Optionally override `parseJobDetails()` for full job page scraping
4. Register in `server/scraper/index.ts` scrapers object
5. Add source to `types/index.ts` JobSource enum

### Database

SQLite with auto-initialization. Schema in `server/database/schema.sql`. Migrations handled in `server/database/index.ts` via `runMigrations()`. Database path configurable via `NUXT_DATABASE_PATH` env var.

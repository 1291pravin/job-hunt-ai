# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Build & Preview
npm run build        # Build for production
npm run preview      # Preview production build

# Key API Endpoints (via curl or UI)
# POST /api/scrape   - Run job scrapers
# POST /api/match    - Match jobs against resume (AI-powered)
# POST /api/resume   - Upload resume for profile extraction
```

## Architecture

**Nuxt 4** job portal for scraping, AI-matching, and tracking job applications.

- **Frontend**: Vue 3 + Tailwind CSS 4 + TypeScript
- **Backend**: Nitro server + SQLite (better-sqlite3)
- **AI Matching**: Claude Haiku via CLI for cost-efficient scoring
- **Scraping**: Playwright + Chromium for Naukri/LinkedIn

### Key Directories

```
server/
├── api/
│   ├── jobs.*.ts           # Job CRUD endpoints
│   ├── match.post.ts       # AI job matching (20 jobs/batch)
│   ├── resume.*.ts         # Resume upload & profile extraction
│   ├── scrape.post.ts      # Run scrapers
│   ├── settings.*.ts       # App settings
│   ├── auth/               # Login flow for protected scrapers
│   └── agents/             # CLI agent file generation
├── database/
│   ├── index.ts            # DB operations & migrations
│   └── schema.sql          # SQLite schema
├── scraper/
│   ├── sites/              # Site-specific scrapers (base, naukri, linkedin)
│   └── utils/browser.ts    # Playwright management
└── utils/
    └── agent-templates.ts  # Generate .claude/ agent files

app/
├── pages/
│   ├── index.vue           # Job dashboard (default: matched + high score)
│   ├── jobs/[id].vue       # Job detail page
│   └── settings.vue        # Resume upload, scraper config
└── layouts/default.vue     # App shell

types/index.ts              # Zod schemas & TypeScript types
```

### Data Flow

1. **Resume Upload**: `POST /api/resume` → Extract profile via Claude Haiku → Store in settings
2. **Scraping**: `POST /api/scrape` → Playwright scrapes job sites → Jobs saved with status='new'
3. **Matching**: `POST /api/match` → AI scores 20 jobs/batch → Updates status to 'matched' (≥50) or 'ignored' (<50)
4. **Review**: User reviews matched jobs → Manual application → Status: interested → applied → archived

### Job Status Workflow

```
new → matched → interested → applied → archived
         ↓                       ↓
      ignored                 rejected
```

### Database Schema

**jobs**: id, source, external_id, url, title, company, location, salary, experience, description, requirements, posted_at, scraped_at, match_score, status, notes

**applications**: id, job_id, applied_at (simple tracking)

**settings**: key, value (JSON) - stores keywords, sources, resume, profile

### Matching Algorithm

Weighted scoring (0-100):
- Tech Stack: 40%
- Role Alignment: 25%
- Experience Level: 20%
- Domain Relevance: 15%

Threshold: ≥50 = matched, <50 = ignored

### CLI Agent Files

The app generates `.claude/` files for Claude Code CLI usage:
- `.claude/agents/job-matcher.md` - Reference for matching criteria
- `.claude/skills/match-jobs.md` - Skill documentation

Regenerate via Settings page "Regenerate Agents" button or `POST /api/agents/regenerate`.

### Adding a New Scraper

1. Create `server/scraper/sites/newsite.ts` extending `BaseScraper`
2. Implement: `getJobListSelector()`, `buildSearchUrl()`, `parseJobCard()`
3. Register in `server/scraper/index.ts`
4. Add source to `types/index.ts` JobSource enum

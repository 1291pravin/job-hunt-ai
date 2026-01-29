# Job Portal App - Manual Application Workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82.svg)](https://nuxt.com/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)

A smart job discovery and tracking application built with Nuxt 4. Finds relevant jobs through AI-powered matching while keeping you in full control of the application process.

## Philosophy: Manual > Automated

**What This App Does:**
- Discovers jobs from multiple sources (Naukri, LinkedIn)
- AI-powered matching using your full resume (Claude Haiku)
- Organizes jobs with match scores and status tracking
- Tracks your application pipeline

**What This App Doesn't Do:**
- No auto-apply to jobs
- No automated email sending
- No form auto-fill
- You review, you decide, you apply manually

> This is a local-first app. Your job search data stays on your machine. See [Why Local?](#why-local) below.

## How It Works

```
Upload Resume --> AI Profile Extraction --> Run Scrapers --> New Jobs
--> AI Matching --> Score >= 50? --> Matched --> Manual Review --> Apply --> Track
                    Score < 50?  --> Ignored
```

1. **Upload Resume** - AI extracts your profile (skills, experience, preferences)
2. **Configure & Scrape** - Playwright scrapes Naukri/LinkedIn for jobs
3. **AI Matching** - Claude Haiku scores each job (0-100)
4. **Review Matches** - You review jobs scoring >= 50
5. **Apply Manually** - Visit original site, apply thoughtfully
6. **Track Progress** - Update status and add notes

## Features

### Resume Management
- Upload your resume (.md, .txt, .markdown)
- AI extracts your profile automatically (experience, tech stacks, target roles, domains, location preferences)
- Used for intelligent job matching

### Intelligent Job Matching

Weighted scoring algorithm:
- **Tech Stack Match:** 40%
- **Role Alignment:** 25%
- **Experience Level:** 20%
- **Domain Relevance:** 15%

Batch processing: 20 jobs per run. Threshold: matched >= 50, ignored < 50.

### Job Status Workflow
```
new --> matched --> interested --> applied --> archived
            |                        |
         ignored                  rejected
```

### Multi-Site Job Scraping
- **Naukri**: Search-based scraping
- **LinkedIn**: Search + recommendations scraping
- Playwright-based for reliable extraction
- Automatic deduplication by external job ID

### Settings Management
- Keywords customization
- Job sources selection
- Scraping configuration
- Resume profile display
- Claude agent regeneration

## Why Local?

| Reason | Explanation |
|--------|-------------|
| **Login sessions** | Scraping Naukri/LinkedIn requires your logged-in browser session |
| **Data privacy** | Your resume, job matches, and application history stay on your machine |
| **Playwright/Chromium** | Browser automation needs ~400MB+ and persistent state |
| **SQLite** | Local database means your data persists without cloud dependency |
| **No recurring costs** | No server to pay for - just ~$0.22/month in AI tokens |

### Can I deploy it anyway?

If you want a hosted version (e.g., for a team), consider:
- **Railway** or **Render** - Docker support with persistent volumes
- **Self-hosted VPS** - Full control on DigitalOcean/Hetzner
- **Docker Compose** - For local server deployment

Cloud platforms like Vercel/Netlify won't work due to Playwright size limits and stateless architecture.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vue 3, Nuxt 4, TypeScript, Tailwind CSS 4 |
| **Backend** | Nitro server, SQLite (better-sqlite3) |
| **AI** | Claude Haiku (via Claude CLI) |
| **Scraping** | Playwright + Chromium |
| **Validation** | Zod |

## Setup

### Prerequisites
- Node.js 18+
- Claude CLI installed and authenticated
- Chrome/Chromium (for Playwright)

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

### Development

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Production

```bash
# Build
npm run build

# Preview
npm run preview
```

## Usage Guide

### Step 1: Upload Resume

1. Navigate to Settings page (`/settings`)
2. Click "Upload Resume"
3. Select your resume file (.md, .txt, .markdown)
4. Wait for AI profile extraction
5. Verify extracted profile data

### Step 2: Configure Settings

1. Review/update keywords (or keep defaults)
2. Select job sources (Naukri, LinkedIn)
3. Set scraping parameters:
   - Scrape mode (search/recommendations/both)
   - Pages to scrape (1-10)

### Step 3: Scrape Jobs

1. Click "Run Scraper" button
2. Wait for scraping to complete
3. Jobs saved with status='new'

### Step 4: Match Jobs

1. Click "Match Jobs" button
2. AI processes 20 jobs at a time
3. Jobs categorized:
   - **matched** (score >= 50): Worth reviewing
   - **ignored** (score < 50): Not a good fit

### Step 5: Review & Apply Manually

1. Go to homepage
2. Filter by status: "matched"
3. Click on a job to view details
4. Click "View Original" to open job site
5. Apply manually on the company's website
6. Return and click "Applied" button
7. Job moves to "applied" status

### Step 6: Track Applications

- View application history on job detail page
- Update status as you progress
- Add notes for follow-ups

## API Endpoints

### Resume Management
- `GET /api/resume` - Get current resume
- `POST /api/resume` - Upload resume (multipart/form-data)
- `DELETE /api/resume` - Delete resume

### Job Management
- `GET /api/jobs` - List jobs (with filters/pagination)
- `POST /api/jobs` - Create job manually
- `GET /api/jobs/:id` - Get job details
- `PATCH /api/jobs/:id` - Update job status/notes
- `DELETE /api/jobs/:id` - Delete job

### Matching & Scraping
- `POST /api/match` - Match jobs against resume
- `POST /api/scrape` - Run job scrapers

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update settings

### Authentication
- `GET /api/auth/status` - Check login status
- `POST /api/auth/login` - Trigger login flow

### Agents
- `POST /api/agents/regenerate` - Regenerate Claude agents

## Database Schema

### Jobs Table
```sql
id, source, external_id, url, title, company, location,
salary, experience, description, requirements,
posted_at, scraped_at, match_score, status, notes
```

### Applications Table
```sql
id, job_id, applied_at
```

### Settings Table
```sql
key, value (JSON)
```

## Cost Analysis

| Activity | Tokens/Run | Frequency | Daily Total |
|----------|------------|-----------|-------------|
| Upload resume | 15K | Once (initial) | 0K |
| Match jobs (20 jobs) | 25K | 1-2x/day | 25-50K |
| **Total** | - | - | **25-50K/day** |

Monthly: ~750K tokens/month at Haiku rates = ~$0.22/month. Within Claude Pro plan: 5-10% usage.

## Directory Structure

```
job-portal-app/
├── app/
│   ├── pages/
│   │   ├── index.vue              # Job listings (default: matched + high score)
│   │   ├── jobs/[id].vue          # Job detail page
│   │   └── settings.vue           # Resume upload & scraper config
│   └── layouts/default.vue        # App shell
├── server/
│   ├── api/
│   │   ├── jobs.*.ts              # Job CRUD
│   │   ├── resume.*.ts            # Resume management
│   │   ├── match.post.ts          # AI matching
│   │   ├── scrape.post.ts         # Run scrapers
│   │   ├── settings.*.ts          # App settings
│   │   ├── auth/                  # Login flow for scrapers
│   │   └── agents/                # CLI agent generation
│   ├── database/
│   │   ├── index.ts               # DB operations & migrations
│   │   └── schema.sql             # SQLite schema
│   ├── scraper/
│   │   ├── index.ts               # Scraper orchestrator
│   │   ├── sites/
│   │   │   ├── base.ts            # Abstract base scraper
│   │   │   ├── naukri.ts          # Naukri scraper
│   │   │   └── linkedin.ts        # LinkedIn scraper
│   │   └── utils/browser.ts       # Playwright setup
│   └── utils/
│       └── agent-templates.ts     # Generate .claude/ files
├── types/index.ts                 # Zod schemas & TypeScript types
├── data/                          # SQLite database (gitignored)
├── playwright-data/               # Browser sessions (gitignored)
└── .claude/                       # Generated agents/skills (gitignored)
```

## Using Claude Code CLI

The app generates `.claude/` agent files that can be used with Claude Code CLI for advanced usage.

### Setup CLI Integration

1. Upload your resume via the Settings page
2. Click "Regenerate Agents" button
3. This creates:
   - `.claude/agents/job-matcher.md` - Matching criteria reference
   - `.claude/skills/match-jobs.md` - Skill documentation

### CLI Commands

```bash
# View your matching criteria
claude "Read the job-matcher agent and summarize my profile"

# Get help understanding a job match
claude "Based on job-matcher criteria, would this job be a good match: [paste job description]"

# Quick status check
claude "What are my primary tech stack requirements?"
```

## Adding a New Scraper

1. Create `server/scraper/sites/newsite.ts` extending `BaseScraper`
2. Implement: `getJobListSelector()`, `buildSearchUrl()`, `parseJobCard()`
3. Register in `server/scraper/index.ts`
4. Update `types/index.ts` JobSource enum

## Troubleshooting

### Resume Upload Fails
- Check Claude CLI is installed: `claude --version`
- Verify authentication: `claude auth status`
- Check file format (.md, .txt, .markdown only)

### Scraping Fails
- Ensure Playwright is installed: `npx playwright install chromium`
- Check login status for sources requiring auth
- Verify source websites are accessible

### Matching Returns No Results
- Ensure resume is uploaded and profile extracted
- Check jobs exist with status='new'
- Verify Claude CLI is working: `echo "test" | claude "say hi"`

### Database Errors
- Delete `data/jobs.db` and restart (recreates schema)
- Check database path in console logs
- Ensure write permissions on `data/` directory

## Contributing

This is a personal project, but suggestions are welcome! Please keep in mind the manual workflow philosophy when proposing features.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [Nuxt 4](https://nuxt.com/) and [Vue 3](https://vuejs.org/)
- AI powered by [Claude](https://www.anthropic.com/) (Anthropic)
- Scraping powered by [Playwright](https://playwright.dev/)
- UI styled with [Tailwind CSS 4](https://tailwindcss.com/)

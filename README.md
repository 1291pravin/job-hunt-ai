# Job Portal App - Manual Application Workflow

A smart job discovery and tracking application built with Nuxt 4. This app helps you find relevant jobs through intelligent AI-powered matching while keeping you in full control of the application process.

## Philosophy: Manual > Automated

**What This App Does:**
- 🎯 Discovers jobs from multiple sources (Naukri, LinkedIn)
- 🤖 AI-powered matching using your full resume (Haiku model)
- 📊 Organizes jobs with match scores and status tracking
- 📝 Tracks your application pipeline

**What This App Doesn't Do:**
- ❌ No auto-apply to jobs
- ❌ No automated email sending
- ❌ No form auto-fill
- ✅ You review, you decide, you apply manually

**Why This Approach:**
- Token efficient: ~40K tokens/day (8% of Claude Pro plan)
- Full control over your applications
- Better job quality through manual review
- Sustainable for daily use

## Features

### 1. Resume Management
- Upload your resume (.md, .txt, .markdown)
- AI extracts your profile (experience, stack, roles, domains)
- Used for intelligent job matching

### 2. Intelligent Job Matching
- Batch processing: 20 jobs per run
- Weighted scoring system:
  - Tech Stack (40%)
  - Role Alignment (25%)
  - Experience Level (20%)
  - Domain Relevance (15%)
- Threshold: matched ≥ 50, ignored < 50

### 3. Job Status Workflow
```
new → matched → interested → applied → rejected/ignored
```

### 4. Job Scrapers
- **Naukri**: Search-based scraping
- **LinkedIn**: Search + recommendations scraping
- Playwright-based for reliable extraction

### 5. Settings Management
- Keywords customization
- Job sources selection
- Scraping configuration
- Resume profile display

## Tech Stack

- **Frontend**: Vue 3 + Nuxt 4 + TypeScript + Tailwind CSS 4
- **Backend**: Nitro server + SQLite (better-sqlite3)
- **AI**: Claude Haiku (via Claude CLI)
- **Scraping**: Playwright + Chromium

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
4. Wait for AI profile extraction (~10-15 seconds)
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
   - **matched** (score ≥ 50): Worth reviewing
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

### Daily Token Usage

| Activity | Tokens | Frequency | Daily Total |
|----------|--------|-----------|-------------|
| Upload resume | 15K | Once (initial) | 0K |
| Match jobs | 25K | 1-2x/day | 25-50K |
| **Total** | - | - | **25-50K** |

**Percentage of Pro Plan:** 5-10% (leaves 90-95% for other work)

### Monthly Cost Estimate
```
Matching: 25K tokens/day × 30 days = 750K tokens/month
At Haiku rates: 750K × $0.03/100K = $0.225/month
```

**Essentially free within Pro plan limits!**

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

### How It Works

The agent files contain your extracted profile:
- Years of experience
- Experience levels (junior, mid, senior, lead, etc.)
- Primary & secondary tech stacks
- Target domains (eCommerce, SaaS, FinTech, etc.)
- Target roles
- Location preferences

This allows Claude Code to give you personalized advice about job opportunities directly in your terminal.

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

## Adding a New Scraper

1. Create `server/scraper/sites/newsite.ts`:
```typescript
import { BaseScraper } from './base'

export class NewSiteScraper extends BaseScraper {
  getJobListSelector(): string {
    return '.job-card' // Your CSS selector
  }

  buildSearchUrl(keywords: string[]): string {
    // Build search URL with keywords
  }

  async parseJobCard(element: ElementHandle): Promise<ParsedJob> {
    // Extract job data from card
  }
}
```

2. Register in `server/scraper/index.ts`:
```typescript
import { NewSiteScraper } from './sites/newsite'

const scrapers = {
  naukri: NaukriScraper,
  linkedin: LinkedInScraper,
  newsite: NewSiteScraper, // Add here
}
```

3. Update `types/index.ts` JobSource enum:
```typescript
export const JobSource = z.enum(['naukri', 'linkedin', 'newsite'])
```

## Future Enhancements (Not Planned)

These are explicitly **NOT** being implemented (manual approach philosophy):

❌ **Auto-Apply Features**
- Auto-fill job application forms
- Auto-answer screening questions
- Auto-submit applications
- Batch apply to multiple jobs

❌ **Email Automation**
- Auto-send cover letters
- Auto-follow up with recruiters
- Email templates with auto-send

✅ **Could Add Later (Aligned with Manual Approach)**
- Application deadline reminders
- Job description comparison tool
- Resume tailoring suggestions
- Interview preparation notes
- Salary negotiation tracker
- Application response tracking

## Contributing

This is a personal project, but suggestions are welcome! Please keep in mind the manual workflow philosophy when proposing features.

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review CLAUDE.md for developer guidance
3. Open an issue on GitHub (if applicable)

## Acknowledgments

- Built with Nuxt 4 and Vue 3
- AI powered by Claude (Anthropic)
- Scraping powered by Playwright
- UI styled with Tailwind CSS 4

---

**Remember:** This app is a discovery and organization tool. You maintain full control over your job applications. Apply thoughtfully and manually! 🎯

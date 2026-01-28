# Job Portal App - Verification Checklist

This document provides a comprehensive checklist to verify all features of the job portal app are working correctly after the final cleanup.

## Prerequisites

Before running verification tests:

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] Claude CLI installed and authenticated (`claude auth status`)
- [ ] Dev server running (`npm run dev`)

## Phase 1: Git Repository Setup ✅

**Status:** COMPLETED

- [x] Git repository initialized
- [x] .gitignore configured properly
- [x] Initial commit created
- [x] Cleanup commits created
- [x] README updated

**Verification:**
```bash
git log --oneline
# Should show 3 commits:
# 1. Initial commit
# 2. Cleanup: Update agent templates
# 3. Update README
```

## Phase 2: Resume Management

### Test 1: Resume Upload

**Steps:**
1. Navigate to `http://localhost:3000/settings`
2. Click "Upload Resume" button
3. Select a `.md` or `.txt` resume file
4. Wait for upload to complete

**Expected Results:**
- [ ] Upload button changes to loading state
- [ ] Success message appears after ~10-15 seconds
- [ ] Resume section expands showing uploaded file
- [ ] Profile extraction completes automatically

**Verification:**
- Check browser console for `[Resume]` logs
- Verify no errors in console
- Confirm API call to `/api/resume` returns 200

**Common Issues:**
- If upload fails, check Claude CLI: `claude --version`
- If no profile appears, check `claude auth status`

### Test 2: Profile Extraction

**Steps:**
1. After resume upload, scroll to "Extracted Profile" section
2. Review displayed profile data

**Expected Results:**
- [ ] Years of experience displayed (e.g., "12")
- [ ] Experience level shown (e.g., "Senior", "Lead")
- [ ] Primary stack technologies listed (e.g., "Vue.js, Nuxt.js, TypeScript")
- [ ] Secondary skills shown
- [ ] Target roles displayed (e.g., "Full Stack Developer", "Tech Lead")
- [ ] Domains listed (e.g., "E-commerce", "Fintech")
- [ ] Location preferences shown (Remote/Hybrid/Onsite)
- [ ] Preferred locations listed

**Verification:**
- Profile data matches your resume content
- No placeholder or "undefined" values
- All arrays properly formatted

**Common Issues:**
- If profile is empty, check resume format (should be plain text)
- If extraction fails, check Claude CLI authentication

### Test 3: Resume Deletion

**Steps:**
1. Click "Delete Resume" button
2. Confirm deletion

**Expected Results:**
- [ ] Confirmation prompt appears
- [ ] Resume deleted successfully
- [ ] Upload section reappears
- [ ] Profile section disappears

**Verification:**
- Check API call to `DELETE /api/resume` returns 200
- Refresh page - resume should not be present

## Phase 3: Settings Configuration

### Test 4: Keywords Management

**Steps:**
1. Navigate to Keywords section
2. View default keywords
3. Click "+" to add a new keyword
4. Enter "Python" and press Enter
5. Click "×" on an existing keyword to remove it
6. Click "Save Settings"

**Expected Results:**
- [ ] Default keywords visible (Vue.js, Nuxt, Full Stack, etc.)
- [ ] Can add new keywords
- [ ] Can remove existing keywords
- [ ] Save button works
- [ ] Success message appears

**Verification:**
- Refresh page - keywords should persist
- Check API call to `POST /api/settings` returns 200

### Test 5: Job Sources Selection

**Steps:**
1. View job sources checkboxes
2. Uncheck "Naukri"
3. Keep "LinkedIn" checked
4. Click "Save Settings"

**Expected Results:**
- [ ] Both sources visible (Naukri, LinkedIn)
- [ ] Can toggle sources on/off
- [ ] Settings save successfully

**Verification:**
- Settings persist after page refresh

### Test 6: Scraping Configuration

**Steps:**
1. View scraping configuration
2. Change scrape mode (Search/Recommendations/Both)
3. Adjust "Pages to scrape" slider (1-10)
4. Click "Save Settings"

**Expected Results:**
- [ ] Scrape mode dropdown works
- [ ] Slider adjusts smoothly
- [ ] Settings save successfully

**Verification:**
- Settings persist after refresh

## Phase 4: Authentication & Browser Sessions

### Test 7: Login Status Check

**Steps:**
1. Navigate to Settings page
2. View Login Status section

**Expected Results:**
- [ ] Browser does NOT auto-open on page load
- [ ] Status shows current login state
- [ ] "Check Status" button works
- [ ] "Login" button opens browser when clicked

**Verification:**
- No browser window opens automatically
- Manual click required to trigger login
- Browser opens only when "Login" clicked

**Common Issues:**
- If browser auto-opens, check `app/pages/settings.vue:78` (onMounted should NOT call checkLoginStatus)

### Test 8: Manual Login Trigger

**Steps:**
1. Click "Login" button
2. Wait for browser to open
3. Complete login on job site
4. Click "Check Status" again

**Expected Results:**
- [ ] Browser opens to login page
- [ ] Can complete login manually
- [ ] Status updates after login
- [ ] Success message appears

## Phase 5: Job Scraping

### Test 9: Run Scraper

**Steps:**
1. Ensure settings are saved
2. Ensure at least one source is enabled
3. Click "Run Scraper" button
4. Wait for scraping to complete

**Expected Results:**
- [ ] Scraper button shows loading state
- [ ] Progress messages appear
- [ ] Success message shows number of jobs scraped
- [ ] Jobs appear in database with status='new'

**Verification:**
- Navigate to homepage
- Filter by status: "new"
- Jobs should appear
- Check console for `[Scraper]` logs

**Common Issues:**
- If scraping fails, ensure Playwright installed
- Check login status for sources requiring auth
- Verify source websites are accessible

## Phase 6: Job Matching

### Test 10: Match Jobs

**Steps:**
1. Ensure resume is uploaded and profile extracted
2. Ensure jobs exist with status='new'
3. Navigate to Settings page
4. Click "Match Jobs" button
5. Wait for matching to complete (~30-40 seconds)

**Expected Results:**
- [ ] Match button shows loading state
- [ ] Progress messages appear
- [ ] Success message shows:
  - Number of matched jobs (score ≥ 50)
  - Number of ignored jobs (score < 50)
  - Total processed (max 20 per run)
- [ ] Jobs status updated in database

**Verification:**
- Navigate to homepage
- Filter by status: "matched"
- Jobs should have match scores displayed
- Check match_score values (0-100)
- Verify reasons are populated

**Token Usage:**
- Check browser console for token count
- Should be ~20-30K tokens for 20 jobs
- Well within Pro plan limits

**Common Issues:**
- If matching fails, check Claude CLI authentication
- Ensure resume is uploaded
- Verify jobs with status='new' exist

### Test 11: Batch Matching

**Steps:**
1. Scrape more than 20 jobs (status='new')
2. Click "Match Jobs" multiple times
3. Verify batching works correctly

**Expected Results:**
- [ ] First run: Processes 20 jobs
- [ ] Second run: Processes next 20 jobs
- [ ] Continues until all 'new' jobs matched
- [ ] No duplicate processing

**Verification:**
- All jobs eventually get status='matched' or 'ignored'
- No jobs remain in 'new' status after sufficient runs

## Phase 7: Job Review & Management

### Test 12: View Matched Jobs

**Steps:**
1. Navigate to homepage (`/`)
2. View job listings

**Expected Results:**
- [ ] Jobs displayed as cards
- [ ] Match scores visible (if matched)
- [ ] Status badges shown
- [ ] Company, location, salary visible
- [ ] Can click to view details

**Verification:**
- Jobs sorted by scraped_at (newest first)
- Pagination works if > 20 jobs
- Filters work correctly

### Test 13: Filter & Search Jobs

**Steps:**
1. Use status filter dropdown
2. Select "matched"
3. Try other status filters

**Expected Results:**
- [ ] Filter dropdown works
- [ ] Jobs filtered by status correctly
- [ ] Count updates dynamically
- [ ] "All" shows all jobs

**Verification:**
- Only jobs with selected status appear
- Status count in stats matches filtered results

### Test 14: Job Detail Page

**Steps:**
1. Click on a matched job
2. Review job details page

**Expected Results:**
- [ ] Job title, company, location displayed
- [ ] Salary shown (if available)
- [ ] Match score displayed prominently
- [ ] Match reason shown
- [ ] Full description visible
- [ ] Requirements section shown
- [ ] "View Original" button works

**Verification:**
- Clicking "View Original" opens job URL in new tab
- No email input fields present
- No "Send Email" button visible
- Status update buttons work

**Important:** Verify NO email section exists (manual workflow)

### Test 15: Status Updates

**Steps:**
1. On job detail page, click status buttons in order:
   - Click "Interested"
   - Click "Applied"
   - Try "Rejected" or "Ignored"

**Expected Results:**
- [ ] Status buttons appear based on current status
- [ ] Clicking button updates status immediately
- [ ] Page reflects new status
- [ ] Can navigate back and status persists

**Verification:**
- Check API call to `PATCH /api/jobs/:id` returns 200
- Status updates in database
- Homepage reflects new status

### Test 16: Manual Application Workflow

**Complete Flow:**
1. View matched job details
2. Click "View Original" → opens job site
3. Apply manually on company's website
4. Return to job portal
5. Click "Applied" button
6. Verify application tracked

**Expected Results:**
- [ ] Job URL opens in new tab
- [ ] Can apply on external site
- [ ] Return to portal without issues
- [ ] Status updates to "applied"
- [ ] Application record created
- [ ] Timestamp recorded

**Verification:**
- Check Applications History section on job detail page
- Verify application entry exists with timestamp
- No auto-generated email content

### Test 17: Job Notes

**Steps:**
1. On job detail page, scroll to Notes section
2. Add a note (e.g., "Applied via email on 2026-01-28")
3. Save notes
4. Refresh page

**Expected Results:**
- [ ] Can add/edit notes
- [ ] Notes save successfully
- [ ] Notes persist after refresh
- [ ] Markdown formatting supported (if implemented)

### Test 18: Delete Job

**Steps:**
1. On job detail page, click "Delete" button
2. Confirm deletion

**Expected Results:**
- [ ] Confirmation prompt appears
- [ ] Job deleted successfully
- [ ] Redirected to homepage
- [ ] Job no longer appears in listings

**Verification:**
- Check API call to `DELETE /api/jobs/:id` returns 200
- Job removed from database

## Phase 8: Agent Generation

### Test 19: Regenerate Agents

**Steps:**
1. Navigate to Settings page
2. Ensure resume is uploaded
3. Scroll to Resume section
4. Click "Regenerate Agents" button
5. Wait for success message

**Expected Results:**
- [ ] Button shows loading state
- [ ] Success message appears
- [ ] Files generated in `.claude/` directory

**Verification:**
```bash
# Check generated files exist
ls .claude/agents/job-matcher.md
ls .claude/skills/match-jobs.md
```

### Test 20: Agent Template Content

**Steps:**
1. Open `.claude/agents/job-matcher.md`
2. Review content

**Expected Results:**
- [ ] Contains your profile data (experience, stack, roles)
- [ ] Shows weighted scoring criteria
- [ ] Explains score ranges (80-100, 50-79, 0-49)
- [ ] Documents manual evaluation guide
- [ ] NO instructions to "read database using Bash"
- [ ] Clarifies this is a reference document
- [ ] Mentions API does actual matching

**Verification:**
- Profile data matches uploaded resume
- Content is readable and accurate
- No database operation instructions present

### Test 21: Skill Template Content

**Steps:**
1. Open `.claude/skills/match-jobs.md`
2. Review content

**Expected Results:**
- [ ] Explains automated matching criteria
- [ ] Shows tech stack, role, experience, domain weights
- [ ] Documents token efficiency
- [ ] Describes manual application workflow
- [ ] NO instructions to query database
- [ ] Clarifies API handles matching

**Verification:**
- Content explains the system, not how to use it
- Reference material, not executable instructions

## Phase 9: Manual Entry

### Test 22: Add Manual Job

**Steps:**
1. Navigate to Settings page
2. Scroll to "Add Job Manually" section
3. Fill in form:
   - URL: https://example.com/job/123
   - Title: Senior Full Stack Developer
   - Company: Example Corp
   - Location: Remote
   - Description: Brief job description
4. Click "Add Job"

**Expected Results:**
- [ ] Form validation works
- [ ] Job created successfully
- [ ] Success message appears
- [ ] Form resets after submission
- [ ] Job appears in listings with status='new'

**Verification:**
- Navigate to homepage
- Find manually added job
- Status should be 'new' (can be matched later)

## Phase 10: Statistics & Dashboard

### Test 23: Dashboard Stats

**Steps:**
1. Navigate to homepage
2. View statistics section

**Expected Results:**
- [ ] Total jobs count displayed
- [ ] Matched jobs count shown
- [ ] Applied jobs count shown
- [ ] Counts update dynamically based on filters

**Verification:**
- Counts match actual database records
- Filtering updates stats correctly

## Phase 11: Database & Persistence

### Test 24: Data Persistence

**Steps:**
1. Add several jobs
2. Match some jobs
3. Update statuses
4. Stop dev server (`Ctrl+C`)
5. Restart dev server (`npm run dev`)
6. Navigate to homepage

**Expected Results:**
- [ ] All jobs still present
- [ ] Match scores preserved
- [ ] Statuses maintained
- [ ] Settings retained
- [ ] Resume still uploaded

**Verification:**
- Database at `data/jobs.db` exists
- Data survives server restarts

### Test 25: Database Schema

**Steps:**
1. Stop dev server
2. Open database: `sqlite3 data/jobs.db`
3. Check schema:
```sql
.schema jobs
.schema applications
.schema settings
```

**Expected Results:**
- [ ] Jobs table has all required columns
- [ ] Applications table exists
- [ ] Settings table exists
- [ ] Indexes created properly

**Verification:**
- `match_score` column exists
- `status` column has CHECK constraint
- `email` and `apply_url` columns present (with comments)

## Phase 12: Token Efficiency

### Test 26: Daily Token Usage

**Monitor token usage over operations:**

| Operation | Expected Tokens | Actual Tokens | Status |
|-----------|-----------------|---------------|--------|
| Upload resume | ~15K | | |
| Match 20 jobs | ~25K | | |
| Multiple matches (40 jobs) | ~50K | | |
| **Daily Total** | **25-50K** | | |

**Expected Results:**
- [ ] Resume upload: 10-20K tokens
- [ ] Batch matching (20 jobs): 20-30K tokens
- [ ] Daily usage well under 100K tokens
- [ ] Uses < 10% of Pro plan (500K/day)

**Verification:**
- Check browser console logs for token counts
- Haiku model used (not Sonnet)
- Full resume context included

## Success Criteria

### Core Functionality ✅

- [ ] Resume uploads successfully
- [ ] Profile extracts correctly using Haiku
- [ ] Job matching works with full resume context
- [ ] Batch matching processes 20 jobs
- [ ] Match scores and statuses update correctly
- [ ] Settings UI shows all features
- [ ] Job detail page has NO email section
- [ ] Manual application tracking works

### Cost Efficiency ✅

- [ ] Haiku model used for extraction (not Sonnet)
- [ ] Haiku model used for matching (not Sonnet)
- [ ] Daily usage < 50K tokens (< 10% of Pro plan)

### Manual Approach ✅

- [ ] No auto-apply functionality anywhere
- [ ] No email sending capability
- [ ] "Apply" workflow opens job URL only
- [ ] User applies manually on external sites
- [ ] Status tracking only (no automation)

### Cleanup Completed ✅

- [ ] Agent templates updated (no Bash tool instructions)
- [ ] Default settings documented as examples
- [ ] Email fields documented (reference only)
- [ ] README comprehensive and accurate
- [ ] Git repository initialized with proper commits

## Known Limitations

### By Design (Manual Approach):
- No auto-apply to jobs
- No email automation
- No form auto-fill
- No bulk application submission

### Technical:
- LinkedIn scraping requires manual login
- Naukri may rate-limit aggressive scraping
- Match scores are AI-generated (may vary)
- Batch matching limited to 20 jobs per run

## Troubleshooting

### Common Issues:

**Resume upload fails:**
- Solution: Check `claude --version` and `claude auth status`

**Scraping fails:**
- Solution: Run `npx playwright install chromium`

**Matching returns no results:**
- Solution: Ensure jobs with status='new' exist

**Browser auto-opens on settings page:**
- Solution: Check `app/pages/settings.vue` - onMounted should NOT call API

**Database errors:**
- Solution: Delete `data/jobs.db` and restart (schema recreates)

## Final Verification Command

Run all checks at once:

```bash
# Prerequisites
claude --version
node --version
npx playwright --version

# Start dev server
npm run dev

# Run through all manual tests above
# ✅ All tests should pass
```

## Completion Checklist

- [ ] All 26 tests passed
- [ ] Core functionality verified
- [ ] Cost efficiency confirmed
- [ ] Manual approach validated
- [ ] Cleanup verified
- [ ] Git commits completed
- [ ] README reviewed
- [ ] CLAUDE.md accurate

## Sign-Off

**Date:** _______________

**Verified by:** _______________

**Status:** [ ] PASS / [ ] FAIL

**Notes:**
____________________________________________
____________________________________________
____________________________________________

---

**End of Verification Document**

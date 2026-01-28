# Contributing to Job Portal App

Thank you for your interest in contributing! This project follows a **manual-first philosophy** - we help users discover and organize jobs, but they apply manually.

## Philosophy

Before contributing, please understand our core principles:

- **No auto-apply features** - Users maintain full control
- **Token efficiency** - Keep AI costs minimal
- **Simplicity over features** - Solve one problem well

## How to Contribute

### Reporting Bugs

1. Check [existing issues](../../issues) to avoid duplicates
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, browser)
   - Error messages/logs

### Suggesting Features

1. Check if it aligns with our manual-first philosophy
2. Use the feature request template
3. Explain the use case and benefit

### Code Contributions

#### Setup

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/job-portal-app.git
cd job-portal-app

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Start dev server
npm run dev
```

#### Development Guidelines

- **TypeScript** - All new code should be typed
- **Vue 3 Composition API** - Use `<script setup>` syntax
- **Tailwind CSS 4** - For styling
- **Zod** - For runtime validation

#### Adding a New Scraper

1. Create `server/scraper/sites/yoursite.ts` extending `BaseScraper`
2. Implement required methods:
   - `getJobListSelector()`
   - `buildSearchUrl()`
   - `parseJobCard()`
3. Register in `server/scraper/index.ts`
4. Add to `JobSource` enum in `types/index.ts`

#### Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally with `npm run dev`
4. Commit with clear messages
5. Push and create a PR

#### Commit Message Format

```
type: short description

Longer explanation if needed.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Documentation

Improvements to docs are always welcome:
- README clarifications
- Code comments
- Usage examples

## What We're Looking For

### Good First Issues

- UI/UX improvements
- Additional job site scrapers
- Better error messages
- Documentation improvements

### Larger Contributions

- New job sources (Indeed, Glassdoor, etc.)
- Export functionality (CSV, JSON)
- Application deadline reminders
- Interview preparation notes

### Out of Scope

These will be closed:
- Auto-apply features
- Email automation
- Form auto-fill
- Anything that applies on user's behalf

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on the problem, not the person

## Questions?

Open a discussion or issue - we're happy to help!

---

Thank you for helping make job searching less painful! 🎯

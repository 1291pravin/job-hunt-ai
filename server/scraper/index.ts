import { getNewPage, closeBrowser } from './utils/browser'
import { naukriScraper } from './sites/naukri'
import { linkedinScraper } from './sites/linkedin'
import { createJob, jobExists, getDatabase, type JobRow } from '../database'
import type { BaseScraper, ScrapeMode } from './sites/base'

const scrapers: Record<string, BaseScraper> = {
  naukri: naukriScraper,
  linkedin: linkedinScraper
}

export interface ScrapeResult {
  source: string
  jobsFound: number
  jobsAdded: number
  jobsSkipped: number
  errors: string[]
  warnings?: string[]
  loginRequired?: boolean
}

export interface ScrapeConfig {
  sources: string[]
  keywords: string[]
  maxPages: number
  fetchFullDetails?: boolean
  mode?: ScrapeMode
}

export async function runScraper(config: ScrapeConfig): Promise<ScrapeResult[]>
export async function runScraper(
  sources: string[],
  keywords: string[],
  maxPages: number,
  fetchFullDetails?: boolean,
  mode?: ScrapeMode
): Promise<ScrapeResult[]>
export async function runScraper(
  configOrSources: ScrapeConfig | string[],
  keywords?: string[],
  maxPages?: number,
  fetchFullDetails: boolean = true,
  mode: ScrapeMode = 'search'
): Promise<ScrapeResult[]> {
  // Handle both call signatures
  let config: ScrapeConfig
  if (Array.isArray(configOrSources)) {
    config = {
      sources: configOrSources,
      keywords: keywords || [],
      maxPages: maxPages || 3,
      fetchFullDetails,
      mode
    }
  } else {
    config = configOrSources
  }

  const results: ScrapeResult[] = []
  const page = await getNewPage()

  try {
    for (const source of config.sources) {
      const scraper = scrapers[source]
      if (!scraper) {
        results.push({
          source,
          jobsFound: 0,
          jobsAdded: 0,
          jobsSkipped: 0,
          errors: [`Unknown scraper: ${source}`]
        })
        continue
      }

      console.log(`[scraper] Running ${source} in mode: ${config.mode || 'search'}`)

      const result = await scraper.scrape(page, {
        keywords: config.keywords,
        maxPages: config.maxPages,
        fetchFullDetails: config.fetchFullDetails ?? true,
        mode: config.mode || 'search'
      })

      let jobsAdded = 0
      let jobsSkipped = 0
      let jobsUpdated = 0

      for (const job of result.jobs) {
        try {
          // Check if job exists
          const database = getDatabase()
          const existingJob = database.prepare('SELECT * FROM jobs WHERE url = ?').get(job.url) as JobRow | undefined

          if (existingJob) {
            // Update existing job with new data if we have better data
            const updates: Partial<JobRow> = {}
            let hasUpdates = false

            // Update fields if new data is better (not null/empty and different)
            if (job.description && (!existingJob.description || existingJob.description.length < 50)) {
              updates.description = job.description
              hasUpdates = true
            }
            if (job.requirements && !existingJob.requirements) {
              updates.requirements = job.requirements
              hasUpdates = true
            }
            if (job.experience && !existingJob.experience) {
              updates.experience = job.experience
              hasUpdates = true
            }
            if (job.salary && (!existingJob.salary || existingJob.salary === 'Not disclosed')) {
              updates.salary = job.salary
              hasUpdates = true
            }
            if (job.postedAt && !existingJob.posted_at) {
              updates.posted_at = job.postedAt
              hasUpdates = true
            }
            if (job.email && !existingJob.email) {
              updates.email = job.email
              hasUpdates = true
            }
            if (job.applyUrl && !existingJob.apply_url) {
              updates.apply_url = job.applyUrl
              hasUpdates = true
            }

            if (hasUpdates) {
              // Build and execute update query
              const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
              const values = [...Object.values(updates), existingJob.id]
              database.prepare(`UPDATE jobs SET ${fields} WHERE id = ?`).run(...values)
              jobsUpdated++
            } else {
              jobsSkipped++
            }
            continue
          }

          // Create new job
          createJob({
            source: job.source,
            external_id: job.externalId || null,
            url: job.url,
            title: job.title,
            company: job.company || null,
            location: job.location || null,
            salary: job.salary || null,
            experience: job.experience || null,
            description: job.description || null,
            requirements: job.requirements || null,
            email: job.email || null,
            apply_url: job.applyUrl || null,
            posted_at: job.postedAt || null,
            match_score: null,
            status: 'new',
            notes: null
          })
          jobsAdded++
        } catch (error) {
          result.errors.push(`Failed to save job: ${error}`)
        }
      }

      if (jobsUpdated > 0) {
        console.log(`[scraper] Updated ${jobsUpdated} existing jobs with new data`)
      }

      results.push({
        source,
        jobsFound: result.jobs.length,
        jobsAdded,
        jobsSkipped,
        errors: result.errors,
        warnings: result.warnings,
        loginRequired: result.loginRequired
      })
    }
  } finally {
    await page.close()
  }

  return results
}

export { closeBrowser }

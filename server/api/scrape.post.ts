import { z } from 'zod'
import { runScraper } from '../scraper'
import { getAllSettings } from '../database'
import type { ScrapeMode } from '../scraper/sites/base'

const schema = z.object({
  sources: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  maxPages: z.number().min(1).max(10).optional(),
  fetchFullDetails: z.boolean().optional(),
  mode: z.enum(['search', 'recommendations', 'both']).optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = schema.safeParse(body || {})

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Validation failed', data: result.error.flatten() })
  }

  // Get settings as defaults
  const settings = getAllSettings()
  const defaultKeywords = JSON.parse(settings.keywords || '[]')
  const defaultSources = JSON.parse(settings.enabled_sources || '[]')
  const defaultPages = parseInt(settings.pages_to_scrape || '3', 10)
  const defaultMode = (settings.scrape_mode || 'search') as ScrapeMode

  const sources = result.data.sources || defaultSources
  const keywords = result.data.keywords || defaultKeywords
  const maxPages = result.data.maxPages || defaultPages
  const fetchFullDetails = result.data.fetchFullDetails ?? true
  const mode = result.data.mode || defaultMode

  if (sources.length === 0) {
    throw createError({ statusCode: 400, message: 'No sources specified' })
  }

  // Keywords only required for search and both modes
  if ((mode === 'search' || mode === 'both') && keywords.length === 0) {
    throw createError({ statusCode: 400, message: 'No keywords specified for search mode' })
  }

  console.log(`[Scrape API] Starting scrape: sources=${sources.join(',')}, keywords=${keywords.join(',')}, mode=${mode}, fetchFullDetails=${fetchFullDetails}`)

  const results = await runScraper({
    sources,
    keywords,
    maxPages,
    fetchFullDetails,
    mode
  })

  const totalJobsAdded = results.reduce((sum, r) => sum + r.jobsAdded, 0)
  const anyLoginRequired = results.some(r => r.loginRequired)
  const allWarnings = results.flatMap(r => r.warnings || [])

  return {
    results,
    totalJobsAdded,
    loginRequired: anyLoginRequired,
    warnings: allWarnings
  }
})

import type { Page } from 'playwright'

export interface JobListing {
  source: string
  externalId?: string
  url: string
  title: string
  company?: string
  location?: string
  salary?: string
  experience?: string
  description?: string
  requirements?: string
  email?: string
  applyUrl?: string
  postedAt?: string
}

export type ScrapeMode = 'search' | 'recommendations' | 'both'

export interface ScrapeOptions {
  keywords: string[]
  maxPages: number
  fetchFullDetails?: boolean
  mode?: ScrapeMode
}

export interface ScraperResult {
  jobs: JobListing[]
  errors: string[]
  loginRequired?: boolean
  warnings?: string[]
}

export interface ScraperCapabilities {
  supportsRecommendations: boolean
  requiresLogin: boolean
  recommendationsRequireLogin: boolean
}

export abstract class BaseScraper {
  abstract name: string
  abstract baseUrl: string

  abstract getJobListSelector(): string
  abstract buildSearchUrl(keywords: string[], page: number): string
  abstract parseJobCard(page: Page, index: number): Promise<Partial<JobListing>>

  // Optional: Override this method to fetch full job details from individual job pages
  async parseJobDetails(_page: Page, _url: string): Promise<Partial<JobListing>> {
    return {}
  }

  getNextPageSelector(): string | null {
    return null
  }

  async hasNextPage(page: Page): Promise<boolean> {
    const selector = this.getNextPageSelector()
    if (!selector) return false
    try {
      return (await page.$(selector)) !== null
    } catch {
      return false
    }
  }

  // --- Capabilities and Recommendations Support ---

  /**
   * Get scraper capabilities - override in subclasses
   */
  getCapabilities(): ScraperCapabilities {
    return {
      supportsRecommendations: false,
      requiresLogin: false,
      recommendationsRequireLogin: true
    }
  }

  /**
   * Check if logged in on the current page - override in subclasses
   */
  async isLoggedIn(_page: Page): Promise<boolean> {
    return false
  }

  /**
   * Get URL for recommendations page - override in subclasses
   */
  getRecommendationsUrl(): string | null {
    return null
  }

  /**
   * Get selector for recommendation list items - override in subclasses
   */
  getRecommendationListSelector(): string {
    return this.getJobListSelector()
  }

  /**
   * Parse a recommendation card - defaults to parseJobCard
   */
  async parseRecommendationCard(page: Page, index: number): Promise<Partial<JobListing>> {
    return this.parseJobCard(page, index)
  }

  /**
   * Scroll to load more jobs (for infinite scroll pages)
   */
  async scrollToLoadMore(page: Page, maxScrolls: number = 5): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      const previousHeight = await page.evaluate(() => document.body.scrollHeight)

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })

      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 2000))

      const newHeight = await page.evaluate(() => document.body.scrollHeight)

      // If no new content loaded, stop scrolling
      if (newHeight === previousHeight) {
        console.log(`[${this.name}] No more content to load after ${i + 1} scrolls`)
        break
      }

      console.log(`[${this.name}] Scrolled ${i + 1}/${maxScrolls}, new height: ${newHeight}`)
    }
  }

  /**
   * Scrape recommendations page
   */
  async scrapeRecommendations(page: Page, options: ScrapeOptions): Promise<ScraperResult> {
    const jobs: JobListing[] = []
    const errors: string[] = []
    const warnings: string[] = []

    const recommendationsUrl = this.getRecommendationsUrl()
    if (!recommendationsUrl) {
      return {
        jobs: [],
        errors: ['This scraper does not support recommendations'],
        loginRequired: false
      }
    }

    console.log(`[${this.name}] Scraping recommendations from: ${recommendationsUrl}`)

    try {
      // Use domcontentloaded instead of networkidle for faster, more reliable loading
      // Heavy sites like Naukri/LinkedIn have continuous network activity that prevents networkidle
      await page.goto(recommendationsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

      // Wait for page to stabilize - give dynamic content time to load
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Check if logged in
      const loggedIn = await this.isLoggedIn(page)
      if (!loggedIn) {
        return {
          jobs: [],
          errors: [],
          warnings: ['Not logged in - cannot access recommendations'],
          loginRequired: true
        }
      }

      // Wait for content and scroll to load more
      try {
        await page.waitForSelector(this.getRecommendationListSelector(), { timeout: 15000 })
      } catch {
        console.log(`[${this.name}] No recommendations found`)
        return { jobs: [], errors: [], warnings: ['No recommendations found'] }
      }

      // Scroll to load more recommendations
      await this.scrollToLoadMore(page, options.maxPages * 2)

      const jobCards = await page.$$(this.getRecommendationListSelector())
      console.log(`[${this.name}] Found ${jobCards.length} recommendation cards`)

      // Parse all recommendation cards
      const pageJobs: JobListing[] = []
      for (let i = 0; i < jobCards.length; i++) {
        try {
          const jobData = await this.parseRecommendationCard(page, i)
          if (jobData.url && jobData.title) {
            pageJobs.push({
              source: `${this.name}-recommended`,
              url: jobData.url.startsWith('http') ? jobData.url : `${this.baseUrl}${jobData.url}`,
              title: jobData.title,
              company: jobData.company,
              location: jobData.location,
              salary: jobData.salary,
              experience: jobData.experience,
              description: jobData.description,
              requirements: jobData.requirements,
              email: jobData.email,
              applyUrl: jobData.applyUrl,
              postedAt: jobData.postedAt,
              externalId: jobData.externalId
            })
          }
        } catch (error) {
          errors.push(`Failed to parse recommendation card ${i + 1}: ${error}`)
        }
      }

      // Fetch full details if enabled
      if (options.fetchFullDetails && pageJobs.length > 0) {
        console.log(`[${this.name}] Fetching full details for ${pageJobs.length} recommendations...`)
        for (let i = 0; i < pageJobs.length; i++) {
          const job = pageJobs[i]
          if (!job) continue

          try {
            console.log(`[${this.name}] Fetching details ${i + 1}/${pageJobs.length}: ${job.title}`)
            const fullDetails = await this.parseJobDetails(page, job.url)

            pageJobs[i] = {
              ...job,
              ...fullDetails,
              title: fullDetails.title || job.title,
              company: fullDetails.company || job.company,
              location: fullDetails.location || job.location,
              salary: fullDetails.salary || job.salary,
              url: job.url,
              source: job.source
            }
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500))
          } catch (error) {
            errors.push(`Failed to fetch details for recommendation ${i + 1}: ${error}`)
          }
        }
      }

      jobs.push(...pageJobs)
    } catch (error) {
      errors.push(`Failed to scrape recommendations: ${error}`)
    }

    console.log(`[${this.name}] Recommendations complete. Found ${jobs.length} jobs, ${errors.length} errors`)
    return { jobs, errors, warnings }
  }

  /**
   * Main scrape method - dispatches based on mode
   */
  async scrape(page: Page, options: ScrapeOptions): Promise<ScraperResult> {
    const mode = options.mode || 'search'
    const capabilities = this.getCapabilities()

    // Handle different modes
    if (mode === 'recommendations') {
      if (!capabilities.supportsRecommendations) {
        return {
          jobs: [],
          errors: [`${this.name} does not support recommendations`],
          warnings: []
        }
      }
      return this.scrapeRecommendations(page, options)
    }

    if (mode === 'both') {
      // Try recommendations first if supported
      let recommendationJobs: JobListing[] = []
      let recommendationErrors: string[] = []
      let warnings: string[] = []
      let loginRequired = false

      if (capabilities.supportsRecommendations) {
        const recResult = await this.scrapeRecommendations(page, options)
        recommendationJobs = recResult.jobs
        recommendationErrors = recResult.errors || []
        warnings = recResult.warnings || []
        loginRequired = recResult.loginRequired || false

        if (loginRequired) {
          warnings.push('Skipping recommendations - login required')
        }
      }

      // Then do keyword search
      const searchResult = await this.scrapeSearch(page, options)

      return {
        jobs: [...recommendationJobs, ...searchResult.jobs],
        errors: [...recommendationErrors, ...searchResult.errors],
        warnings,
        loginRequired
      }
    }

    // Default: search mode
    return this.scrapeSearch(page, options)
  }

  /**
   * Scrape using keyword search
   */
  async scrapeSearch(page: Page, options: ScrapeOptions): Promise<ScraperResult> {
    const jobs: JobListing[] = []
    const errors: string[] = []

    console.log(`[${this.name}] Starting search scrape with keywords: ${options.keywords.join(', ')}`)

    for (let pageNum = 1; pageNum <= options.maxPages; pageNum++) {
      try {
        const searchUrl = this.buildSearchUrl(options.keywords, pageNum)
        console.log(`[${this.name}] Scraping page ${pageNum}: ${searchUrl}`)

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await new Promise(resolve => setTimeout(resolve, 2000))

        try {
          await page.waitForSelector(this.getJobListSelector(), { timeout: 15000 })
        } catch {
          console.log(`[${this.name}] No job listings found on page ${pageNum}`)
          break
        }

        const jobCards = await page.$$(this.getJobListSelector())
        console.log(`[${this.name}] Found ${jobCards.length} job cards`)

        // First collect all job card data
        const pageJobs: JobListing[] = []
        for (let i = 0; i < jobCards.length; i++) {
          try {
            const jobData = await this.parseJobCard(page, i)
            if (jobData.url && jobData.title) {
              pageJobs.push({
                source: this.name,
                url: jobData.url.startsWith('http') ? jobData.url : `${this.baseUrl}${jobData.url}`,
                title: jobData.title,
                company: jobData.company,
                location: jobData.location,
                salary: jobData.salary,
                experience: jobData.experience,
                description: jobData.description,
                requirements: jobData.requirements,
                email: jobData.email,
                applyUrl: jobData.applyUrl,
                postedAt: jobData.postedAt,
                externalId: jobData.externalId
              })
            }
          } catch (error) {
            errors.push(`Failed to parse job card ${i + 1}: ${error}`)
          }
        }

        // If fetchFullDetails is enabled, navigate to each job page for full details
        if (options.fetchFullDetails) {
          console.log(`[${this.name}] Fetching full details for ${pageJobs.length} jobs...`)
          for (let i = 0; i < pageJobs.length; i++) {
            const job = pageJobs[i]
            if (!job) continue

            try {
              console.log(`[${this.name}] Fetching details ${i + 1}/${pageJobs.length}: ${job.title}`)

              const fullDetails = await this.parseJobDetails(page, job.url)

              // Merge full details with card data (full details take precedence)
              pageJobs[i] = {
                ...job,
                ...fullDetails,
                // Keep original values if full details are empty
                title: fullDetails.title || job.title,
                company: fullDetails.company || job.company,
                location: fullDetails.location || job.location,
                salary: fullDetails.salary || job.salary,
                url: job.url, // Always keep original URL
                source: job.source
              }

              // Add delay between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500))
            } catch (error) {
              errors.push(`Failed to fetch details for job ${i + 1}: ${error}`)
            }
          }

          // Return to search results page before checking pagination
          console.log(`[${this.name}] Returning to search results: ${searchUrl}`)
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await new Promise(resolve => setTimeout(resolve, 2000))
          await page.waitForSelector(this.getJobListSelector(), { timeout: 15000 }).catch(() => {})
        }

        jobs.push(...pageJobs)

        if (pageNum < options.maxPages && !(await this.hasNextPage(page))) {
          break
        }

        if (pageNum < options.maxPages) {
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
        }
      } catch (error) {
        errors.push(`Failed to scrape page ${pageNum}: ${error}`)
      }
    }

    console.log(`[${this.name}] Complete. Found ${jobs.length} jobs, ${errors.length} errors`)
    return { jobs, errors }
  }
}

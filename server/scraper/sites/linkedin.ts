/// <reference lib="dom" />
import type { Page } from 'playwright'
import { BaseScraper, type JobListing, type ScraperCapabilities } from './base'

export class LinkedInScraper extends BaseScraper {
  name = 'linkedin'
  baseUrl = 'https://www.linkedin.com'

  override getCapabilities(): ScraperCapabilities {
    return {
      supportsRecommendations: true,
      requiresLogin: false, // Can do public search without login
      recommendationsRequireLogin: true
    }
  }

  override async isLoggedIn(page: Page): Promise<boolean> {
    const loggedInSelectors = [
      '.global-nav__me-photo',
      '.feed-identity-module',
      '.global-nav__me-content',
      '.profile-rail-card__actor-link',
      'img.global-nav__me-photo'
    ]

    for (const selector of loggedInSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          return true
        }
      } catch {
        // Continue checking
      }
    }
    return false
  }

  override getRecommendationsUrl(): string {
    return `${this.baseUrl}/jobs/collections/recommended/`
  }

  override getRecommendationListSelector(): string {
    // LinkedIn now uses simple li elements in main lists
    return 'main ul > li, .scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container'
  }

  getJobListSelector(): string {
    // LinkedIn now uses simple li elements in main lists
    return 'main ul > li, .jobs-search-results__list-item, .job-card-container, .base-search-card'
  }

  buildSearchUrl(keywords: string[], pageNum: number): string {
    const query = encodeURIComponent(keywords.join(' '))
    const start = (pageNum - 1) * 25
    // f_WT=2 = Remote filter
    return `${this.baseUrl}/jobs/search/?keywords=${query}&location=India&f_WT=2&start=${start}`
  }

  override getNextPageSelector(): string | null {
    return 'button[aria-label="Next"], button[aria-label="View next page"]'
  }

  async parseJobCard(page: Page, index: number): Promise<Partial<JobListing>> {
    return await page.evaluate((idx) => {
      // LinkedIn now uses li elements in a list for job cards
      const cards = document.querySelectorAll('main ul > li, .jobs-search-results__list-item, .job-card-container, .base-search-card')
      const card = cards[idx] as HTMLElement
      if (!card) return {}

      // Helper to get text from first matching element
      const getTextContent = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector)
          if (el?.textContent?.trim()) {
            return el.textContent.trim()
          }
        }
        return undefined
      }

      // Helper to get href from first matching link
      const getHref = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector) as HTMLAnchorElement
          if (el?.href) {
            return el.href.split('?')[0] // Remove query params
          }
        }
        return undefined
      }

      // New approach: Find elements by structure and content patterns
      const links = Array.from(card.querySelectorAll('a'))
      let jobUrl: string | undefined
      let title: string | undefined

      for (const link of links) {
        const href = link.href || ''
        if (href.includes('/jobs/view/')) {
          jobUrl = href.split('?')[0]
          const linkText = link.textContent?.trim()
          if (linkText && linkText.length > 5 && !linkText.includes('Easy Apply')) {
            title = linkText
          }
          break
        }
      }

      // Find company name - look for text that's not the title
      let company: string | undefined
      const allDivs = Array.from(card.querySelectorAll('div, span'))
      for (const div of allDivs) {
        const text = div.textContent?.trim() || ''
        if (text && text !== title && text.length > 1 && text.length < 100 &&
            !text.includes('Remote') && !text.includes('India') &&
            !text.includes('ago') && !text.includes('Apply') &&
            !text.includes('Promoted') && !text.includes('Viewed') &&
            div.children.length === 0) {
          company = text
          break
        }
      }

      // Find location
      let location: string | undefined
      for (const div of allDivs) {
        const text = div.textContent?.trim() || ''
        if (text && (text.includes('Remote') || text.includes('India') || text.includes('Hybrid')) &&
            text.length < 100 && div.children.length === 0) {
          location = text
          break
        }
      }

      // Find posted time
      let postedAt: string | undefined
      for (const div of allDivs) {
        const text = div.textContent?.trim() || ''
        if (text.includes('ago') && text.length < 30 && div.children.length === 0) {
          postedAt = text
          break
        }
      }

      // Extract job ID from URL
      const jobIdMatch = jobUrl?.match(/\/jobs\/view\/(\d+)/)
      const externalId = jobIdMatch ? jobIdMatch[1] : undefined

      return {
        title: title || getTextContent([
          '.job-card-list__title',
          '.base-search-card__title',
          'a[href*="/jobs/view/"] span',
          'strong'
        ]),
        company: company || getTextContent([
          '.job-card-container__company-name',
          '.base-search-card__subtitle'
        ]),
        location: location || getTextContent([
          '.job-card-container__metadata-item',
          '.job-search-card__location'
        ]),
        url: jobUrl || getHref([
          'a[href*="/jobs/view/"]',
          'a.job-card-container__link',
          'a.base-card__full-link'
        ]),
        postedAt: postedAt || getTextContent([
          'time',
          '.job-search-card__listdate'
        ]),
        externalId
      }
    }, index)
  }

  override async parseJobDetails(page: Page, url: string): Promise<Partial<JobListing>> {
    try {
      console.log(`[linkedin] Parsing job details from ${url}`)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Wait for the page content
      await page.waitForSelector('h2, main', { timeout: 15000 }).catch(() => {})

      // Try to expand "See more" if present
      try {
        const seeMoreButton = await page.$('button:has-text("more")')
        if (seeMoreButton) {
          await seeMoreButton.click()
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch {
        // Button might not exist
      }

      return await page.evaluate(() => {
        // Helper to find element by text content
        const findByText = (selector: string, text: string): Element | null => {
          const elements = Array.from(document.querySelectorAll(selector))
          for (const el of elements) {
            if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
              return el
            }
          }
          return null
        }

        // Find company from link with /company/ in href (find one with actual text)
        const companyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]'))
        let company: string | undefined
        for (const link of companyLinks) {
          const text = link.textContent?.trim()
          if (text && text.length > 0 && text.length < 100 && !text.includes('followers')) {
            company = text
            break
          }
        }

        // Find title - look in toolbar or main area
        let title: string | undefined
        const toolbar = document.querySelector('[role="toolbar"]')
        if (toolbar) {
          const toolbarDivs = Array.from(toolbar.querySelectorAll('div, span'))
          for (const div of toolbarDivs) {
            const text = div.textContent?.trim() || ''
            if (text.length > 10 && text.length < 200 && !text.includes('•') && !text.includes('Save') && !text.includes('Apply')) {
              title = text
              break
            }
          }
        }
        if (!title) {
          const h1 = document.querySelector('h1')
          title = h1?.textContent?.trim()
        }

        // Find the main content area
        const main = document.querySelector('main main') || document.querySelector('main')

        // Extract location
        let location: string | undefined
        const allDivs = main ? Array.from(main.querySelectorAll('div, span')) : []
        for (const div of allDivs) {
          const text = div.textContent?.trim() || ''
          if (text && (text.includes('Remote') || text.includes('India') || text.includes('Hybrid')) && text.length < 100) {
            if (!text.includes('About') && !text.includes('Apply')) {
              location = text
              break
            }
          }
        }

        // Extract posted time
        let postedAt: string | undefined
        for (const div of allDivs) {
          const text = div.textContent?.trim() || ''
          if (text.includes('ago') && text.length < 50) {
            postedAt = text
            break
          }
        }

        // Find "About the job" heading and extract description
        let description: string | undefined
        const aboutHeading = findByText('h2', 'about the job')
        if (aboutHeading) {
          let currentEl = aboutHeading.parentElement?.nextElementSibling
          const descriptionParts: string[] = []

          while (currentEl) {
            const h2 = currentEl.querySelector('h2')
            if (h2 && !h2.textContent?.toLowerCase().includes('about the job')) {
              break
            }
            const text = currentEl.textContent?.trim() || ''
            if (text.includes('Requirements added by')) {
              break
            }
            if (currentEl.innerHTML) {
              descriptionParts.push(currentEl.innerHTML)
            }
            currentEl = currentEl.nextElementSibling
          }

          if (descriptionParts.length > 0) {
            description = descriptionParts.join('\n')
          }
        }

        // Fallback: find largest text block
        if (!description) {
          const allParagraphs = Array.from(document.querySelectorAll('p'))
          let longestP = ''
          for (const p of allParagraphs) {
            const text = p.textContent?.trim() || ''
            if (text.length > longestP.length && text.length > 200) {
              longestP = text
            }
          }
          if (longestP) {
            description = longestP
          }
        }

        // Extract work type from buttons
        const workTypes: string[] = []
        const buttons = Array.from(document.querySelectorAll('button'))
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || ''
          if (['Remote', 'Hybrid', 'On-site', 'Full-time', 'Part-time', 'Contract'].includes(text)) {
            workTypes.push(text)
          }
        }

        // Try to find salary info
        let salary: string | undefined
        for (const div of allDivs) {
          const text = div.textContent?.trim() || ''
          if ((text.includes('$') || text.includes('₹') || text.includes('LPA')) && text.length < 100) {
            salary = text
            break
          }
        }

        const externalId = window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1]

        return {
          title,
          company,
          location,
          salary,
          description,
          postedAt,
          experience: undefined,
          requirements: workTypes.join(', ') || undefined,
          externalId
        }
      })
    } catch (error) {
      console.error(`[linkedin] Failed to parse job details from ${url}:`, error)
      return {}
    }
  }

  override async parseRecommendationCard(page: Page, index: number): Promise<Partial<JobListing>> {
    return await page.evaluate((idx) => {
      const cards = document.querySelectorAll('main ul > li, .scaffold-layout__list-item, .jobs-search-results__list-item, .job-card-container')
      const card = cards[idx] as HTMLElement
      if (!card) return {}

      const links = Array.from(card.querySelectorAll('a'))
      let jobUrl: string | undefined
      let title: string | undefined

      for (const link of links) {
        const href = link.href || ''
        if (href.includes('/jobs/view/')) {
          jobUrl = href.split('?')[0]
          const linkText = link.textContent?.trim()
          if (linkText && linkText.length > 5 && !linkText.includes('Easy Apply')) {
            title = linkText
          }
          break
        }
      }

      const jobIdMatch = jobUrl?.match(/\/jobs\/view\/(\d+)/)
      const externalId = jobIdMatch ? jobIdMatch[1] : undefined

      const dataJobId = card.getAttribute('data-job-id') ||
                       card.getAttribute('data-occludable-job-id') ||
                       card.querySelector('[data-job-id]')?.getAttribute('data-job-id')

      const allDivs = Array.from(card.querySelectorAll('div, span'))
      let company: string | undefined
      let location: string | undefined
      let postedAt: string | undefined

      for (const div of allDivs) {
        const text = div.textContent?.trim() || ''
        if (!text || div.children.length > 0) continue

        if (!company && text !== title && text.length > 1 && text.length < 100 &&
            !text.includes('Remote') && !text.includes('India') &&
            !text.includes('ago') && !text.includes('Apply') &&
            !text.includes('Promoted') && !text.includes('Viewed')) {
          company = text
          continue
        }

        if (!location && (text.includes('Remote') || text.includes('India') || text.includes('Hybrid')) &&
            text.length < 100) {
          location = text
          continue
        }

        if (!postedAt && text.includes('ago') && text.length < 30) {
          postedAt = text
        }
      }

      return {
        title,
        company,
        location,
        url: jobUrl,
        externalId: externalId || dataJobId || undefined,
        postedAt
      }
    }, index)
  }
}

export const linkedinScraper = new LinkedInScraper()

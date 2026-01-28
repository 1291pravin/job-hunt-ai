/// <reference lib="dom" />
import type { Page } from 'playwright'
import { BaseScraper, type JobListing, type ScraperCapabilities } from './base'

export class NaukriScraper extends BaseScraper {
  name = 'naukri'
  baseUrl = 'https://www.naukri.com'

  override getCapabilities(): ScraperCapabilities {
    return {
      supportsRecommendations: true,
      requiresLogin: false, // Can do public search without login
      recommendationsRequireLogin: true
    }
  }

  override async isLoggedIn(page: Page): Promise<boolean> {
    const loggedInSelectors = [
      '.nI-gNb-drawer__icon',
      '.user-prof-icon',
      '.nI-gNb-sb__user',
      '.view-profile-wrapper',
      '.nI-gNb-sb__user-name'
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
    return `${this.baseUrl}/mnjuser/recommendedjobs`
  }

  override getRecommendationListSelector(): string {
    return '.recommended-job-card, .rec-job-tuple, .jobTuple, .srp-jobtuple-wrapper'
  }

  getJobListSelector(): string {
    // Naukri uses these selectors for job cards
    return '.srp-jobtuple-wrapper, .jobTuple, article.jobTuple'
  }

  buildSearchUrl(keywords: string[], pageNum: number): string {
    const query = keywords.join('-').toLowerCase().replace(/\s+/g, '-')
    if (pageNum === 1) {
      return `${this.baseUrl}/${query}-jobs`
    }
    return `${this.baseUrl}/${query}-jobs-${pageNum}`
  }

  override getNextPageSelector(): string | null {
    return 'a.fright.fs14.btn-secondary.br2'
  }

  override async parseJobDetails(page: Page, url: string): Promise<Partial<JobListing>> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Wait for job details to load
      await page.waitForSelector('.styles_jd-header-wrapper__UJTU4, .jd-header-wrapper, .job-details', { timeout: 15000 }).catch(() => {})

      return await page.evaluate(() => {
        const getTextContent = (selectors: string[]): string | undefined => {
          for (const selector of selectors) {
            const el = document.querySelector(selector)
            if (el?.textContent?.trim()) {
              return el.textContent.trim()
            }
          }
          return undefined
        }

        const getHtmlContent = (selectors: string[]): string | undefined => {
          for (const selector of selectors) {
            const el = document.querySelector(selector)
            if (el?.innerHTML?.trim()) {
              return el.innerHTML.trim()
            }
          }
          return undefined
        }

        // Get all key-value details from the job page
        const getJobHighlights = (): Record<string, string> => {
          const highlights: Record<string, string> = {}
          const keyValuePairs = document.querySelectorAll('.styles_details__Y424J .styles_detail__lT1PC, .key-value, .details-row')

          keyValuePairs.forEach((pair: Element) => {
            const label = pair.querySelector('.styles_label__YTVYY, .label, dt')?.textContent?.trim()
            const value = pair.querySelector('.styles_value__BEsNS, .value, dd')?.textContent?.trim()
            if (label && value) {
              highlights[label.toLowerCase().replace(/[^a-z]/g, '')] = value
            }
          })

          return highlights
        }

        const highlights = getJobHighlights()

        // Extract job description
        const description = getHtmlContent([
          '.styles_JDC__dang-inner-html__h0K4t',
          '.dang-inner-html',
          '.job-desc',
          '.jobDescriptionText',
          '.styles_job-desc-container__txpYf',
          '#job-description',
          '.jd-desc'
        ])

        // Extract requirements/skills
        const requirements = getTextContent([
          '.styles_key-skill__GIPn_ .chip',
          '.key-skill .chip',
          '.chip-container .chip',
          '.skills-section'
        ])

        // Get all skill chips
        const skillChips = Array.from(document.querySelectorAll('.styles_key-skill__GIPn_ a, .key-skill a, .chip'))
          .map((el: Element) => el.textContent?.trim())
          .filter(Boolean)
          .join(', ')

        // Extract company details
        const companyName = getTextContent([
          '.styles_jd-header-comp-name__MvqAI a',
          '.jd-header-comp-name a',
          '.company-name',
          '.comp-name a'
        ])

        // Extract salary
        const salary = getTextContent([
          '.styles_jhc__salary__jdfEC',
          '.salary',
          '.salaryText',
          '.sal'
        ])

        // Extract location
        const location = getTextContent([
          '.styles_jhc__loc___Du2H',
          '.loc',
          '.location',
          '.locWdth'
        ])

        // Extract experience
        const experience = getTextContent([
          '.styles_jhc__exp__k_giM',
          '.exp',
          '.experience'
        ])

        // Extract job title
        const title = getTextContent([
          '.styles_jd-header-title__rZwM1',
          '.jd-header-title',
          '.job-title',
          'h1.title'
        ])

        // Extract apply URL if different
        const applyButton = document.querySelector('.styles_apply-button__uStvl a, .apply-button a, a[href*="apply"]') as HTMLAnchorElement
        const applyUrl = applyButton?.href

        // Extract posted date
        const postedAt = getTextContent([
          '.styles_jhc__jd-stats__lT29m span:last-child',
          '.post-date',
          '.postDate',
          '.postedDate'
        ])

        // Try to extract email from description
        const emailMatch = description?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        const email = emailMatch ? emailMatch[0] : undefined

        // Extract external job ID from URL or page
        const urlMatch = window.location.href.match(/job-listings-([^?]+)/) ||
                        window.location.href.match(/jid=(\d+)/)
        const externalId = urlMatch ? urlMatch[1] : undefined

        return {
          title,
          company: companyName,
          location,
          salary: salary || highlights['salary'],
          description,
          requirements: skillChips || requirements,
          experience: experience || highlights['experience'],
          email,
          applyUrl,
          postedAt,
          externalId
        }
      })
    } catch (error) {
      console.error(`[naukri] Failed to parse job details from ${url}:`, error)
      return {}
    }
  }

  async parseJobCard(page: Page, index: number): Promise<Partial<JobListing>> {
    return await page.evaluate((idx) => {
      const cards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple, article.jobTuple')
      const card = cards[idx] as HTMLElement
      if (!card) return {}

      // Try multiple selector patterns as Naukri updates their HTML frequently
      const getTextContent = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector)
          if (el?.textContent?.trim()) {
            return el.textContent.trim()
          }
        }
        return undefined
      }

      const getHref = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector) as HTMLAnchorElement
          if (el?.href) {
            return el.href
          }
        }
        return undefined
      }

      return {
        title: getTextContent([
          '.title',
          'a.title',
          '.jobTupleHeader a',
          '.row1 a.title',
          'h2 a',
          '.info .title'
        ]),
        company: getTextContent([
          '.comp-name',
          '.companyInfo .subTitle',
          '.jobTupleHeader .subTitle',
          'a.subTitle',
          '.company-name',
          '.row2 .comp-name'
        ]),
        location: getTextContent([
          '.loc-wrap .locWdth',
          '.loc',
          '.location',
          '.locWdth',
          '.row3 .loc-wrap span',
          '.ni-job-tuple-icon-srp-location + span'
        ]),
        salary: getTextContent([
          '.sal-wrap .ni-job-tuple-icon-srp-rupee + span',
          '.salary',
          '.sal',
          '.row4 .sal-wrap span',
          '.ni-job-tuple-icon-srp-rupee'
        ]),
        url: getHref([
          'a.title',
          '.title a',
          '.jobTupleHeader a',
          'h2 a',
          'a[href*="/job-listings"]'
        ]),
        description: getTextContent([
          '.job-desc',
          '.jobTupleFooter .ellipsis',
          '.row5 .ellipsis',
          '.job-description'
        ]),
        postedAt: getTextContent([
          '.job-post-day',
          '.postDate',
          '.freshness span',
          '.row6 span'
        ])
      }
    }, index)
  }

  override async parseRecommendationCard(page: Page, index: number): Promise<Partial<JobListing>> {
    return await page.evaluate((idx) => {
      const cards = document.querySelectorAll('article.jobTuple, .recommended-job-card, .rec-job-tuple, .jobTuple, .srp-jobtuple-wrapper')
      const card = cards[idx] as HTMLElement
      if (!card) return {}

      const getTextContent = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector)
          if (el?.textContent?.trim()) {
            return el.textContent.trim()
          }
        }
        return undefined
      }

      const getHref = (selectors: string[]): string | undefined => {
        for (const selector of selectors) {
          const el = card.querySelector(selector) as HTMLAnchorElement
          if (el?.href) {
            return el.href
          }
        }
        return undefined
      }

      // Helper to create URL slug from text
      const slugify = (text: string): string => {
        return text.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }

      // Updated selectors based on actual Naukri DOM structure
      const title = getTextContent([
        '.title',
        'a.title',
        '.rec-job-title',
        '.jobTupleHeader a',
        'h2 a'
      ])

      // Company name is in companyWrapper, not companyInfo
      const company = getTextContent([
        '.companyWrapper .subTitle',
        '.comp-name',
        '.companyInfo .subTitle:first-child',
        'a.subTitle'
      ])

      // Location is in a specific container with class
      const location = getTextContent([
        '.location span.ellipsis',
        '.location span',
        '.loc-wrap .locWdth',
        '.loc span',
        '.locWdth'
      ])

      // Experience is in experience container
      const experience = getTextContent([
        '.experience span.ellipsis',
        '.experience span',
        '.exp span',
        '.expwdth'
      ])

      // Salary is in salary container
      const salary = getTextContent([
        '.salary span.ellipsis',
        '.salary span',
        '.sal span',
        '.sal-wrap span'
      ])

      // Description snippet from job-description class
      const description = getTextContent([
        '.job-description',
        '.job-desc',
        '.ni-job-tuple-description',
        '.jobDescription'
      ])

      // Skills/requirements from tags container
      const skillElements = card.querySelectorAll('.tags li, .tag-li, .skillsList li, .chipLi')
      const skills = Array.from(skillElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join(', ')

      // Posted date from footer
      const postedAt = getTextContent([
        '.jobTupleFooter .type span',
        '.job-post-day span',
        '.freshness span',
        '.postDate'
      ])

      // Get job ID from data attribute
      const jobId = card.dataset.jobId || card.getAttribute('data-job-id') || card.getAttribute('data-jobid')

      // Try to get URL from anchor first, otherwise construct from job ID
      let url = getHref([
        'a.title',
        '.title a',
        '.rec-job-title a',
        'a[href*="/job-listings"]'
      ])

      // If no anchor URL found but we have job ID, construct the URL
      if (!url && jobId) {
        const parts = []
        if (title) parts.push(slugify(title))
        if (company) parts.push(slugify(company))
        if (location) parts.push(slugify(location))
        if (experience) {
          const expSlug = experience.toLowerCase()
            .replace(/(\d+)\s*-\s*(\d+)\s*yrs?/i, '$1-to-$2-years')
            .replace(/\s+/g, '-')
          parts.push(expSlug)
        }
        parts.push(jobId)
        url = `https://www.naukri.com/job-listings-${parts.join('-')}`
      }

      return {
        title,
        company,
        location,
        experience,
        salary,
        url,
        externalId: jobId,
        description,
        requirements: skills,
        postedAt
      }
    }, index)
  }
}

export const naukriScraper = new NaukriScraper()

import { chromium, type BrowserContext, type Page } from 'playwright'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let browserContext: BrowserContext | null = null

// Use process.cwd() to get project root which works in Nitro
const USER_DATA_DIR = join(process.cwd(), '.browser-data')

export type SupportedSite = 'linkedin' | 'naukri'

export interface LoginStatus {
  isLoggedIn: boolean
  username?: string
}

// Site-specific login detection selectors
const LOGIN_SELECTORS: Record<SupportedSite, { loggedIn: string[], username: string[] }> = {
  linkedin: {
    loggedIn: ['.global-nav__me-photo', '.feed-identity-module', '.profile-rail-card__actor-link', '.global-nav__me-content'],
    username: ['.feed-identity-module__actor-meta', '.profile-rail-card__actor-link', '.global-nav__me-content']
  },
  naukri: {
    loggedIn: ['.nI-gNb-drawer__icon', '.user-prof-icon', '.nI-gNb-sb__user', '.view-profile-wrapper'],
    username: ['.nI-gNb-sb__user-name', '.user-name', '.view-profile-wrapper a']
  }
}

const LOGIN_URLS: Record<SupportedSite, string> = {
  linkedin: 'https://www.linkedin.com/login',
  naukri: 'https://www.naukri.com/nlogin/login'
}

const HOME_URLS: Record<SupportedSite, string> = {
  linkedin: 'https://www.linkedin.com/feed/',
  naukri: 'https://www.naukri.com/mnjuser/homepage'
}

export async function getBrowserContext(): Promise<BrowserContext> {
  if (browserContext) return browserContext

  if (!existsSync(USER_DATA_DIR)) {
    mkdirSync(USER_DATA_DIR, { recursive: true })
  }

  console.log(`[Browser] Launching persistent context at: ${USER_DATA_DIR}`)

  browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  })

  return browserContext
}

export async function getNewPage(): Promise<Page> {
  const context = await getBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.setDefaultNavigationTimeout(60000)
  return page
}

export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    await browserContext.close()
    browserContext = null
  }
}

export async function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Check if user is logged into a specific site
 */
export async function checkLoginStatus(site: SupportedSite): Promise<LoginStatus> {
  const page = await getNewPage()

  try {
    const homeUrl = HOME_URLS[site]
    const selectors = LOGIN_SELECTORS[site]

    console.log(`[Browser] Checking login status for ${site}...`)
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait a bit for page to settle
    await randomDelay(2000, 3000)

    // Check for logged-in indicators
    let isLoggedIn = false
    for (const selector of selectors.loggedIn) {
      try {
        const element = await page.$(selector)
        if (element) {
          isLoggedIn = true
          break
        }
      } catch {
        // Continue checking other selectors
      }
    }

    // Try to extract username if logged in
    let username: string | undefined
    if (isLoggedIn) {
      for (const selector of selectors.username) {
        try {
          const element = await page.$(selector)
          if (element) {
            username = await element.textContent() || undefined
            if (username) {
              username = username.trim().split('\n')[0].trim()
              break
            }
          }
        } catch {
          // Continue checking other selectors
        }
      }
    }

    console.log(`[Browser] ${site} login status: ${isLoggedIn ? 'logged in' : 'not logged in'}${username ? ` as ${username}` : ''}`)

    return { isLoggedIn, username }
  } catch (error) {
    console.error(`[Browser] Error checking login status for ${site}:`, error)
    return { isLoggedIn: false }
  } finally {
    await page.close()
  }
}

/**
 * Open login page for manual login - keeps browser open for user to log in
 */
export async function openLoginPage(site: SupportedSite): Promise<{ success: boolean; message: string }> {
  try {
    const loginUrl = LOGIN_URLS[site]
    const page = await getNewPage()

    console.log(`[Browser] Opening login page for ${site}...`)
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Keep the page open for manual login - don't close it
    // The user will log in manually and then verify status

    return {
      success: true,
      message: `Login page opened for ${site}. Please log in manually in the browser window, then click "Verify" to confirm.`
    }
  } catch (error) {
    console.error(`[Browser] Error opening login page for ${site}:`, error)
    return {
      success: false,
      message: `Failed to open login page for ${site}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Check login status on a given page (for use during scraping)
 */
export async function isLoggedInOnPage(page: Page, site: SupportedSite): Promise<boolean> {
  const selectors = LOGIN_SELECTORS[site]

  for (const selector of selectors.loggedIn) {
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

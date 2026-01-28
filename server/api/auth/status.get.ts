import { checkLoginStatus, type SupportedSite } from '../../scraper/utils/browser'

const SUPPORTED_SITES: SupportedSite[] = ['linkedin', 'naukri']

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const site = query.site as string | undefined

  try {
    // If specific site requested
    if (site && site !== 'all') {
      if (!SUPPORTED_SITES.includes(site as SupportedSite)) {
        throw createError({
          statusCode: 400,
          message: `Invalid site: ${site}. Supported sites: ${SUPPORTED_SITES.join(', ')}`
        })
      }

      const status = await checkLoginStatus(site as SupportedSite)
      return {
        [site]: status
      }
    }

    // Return status for all sites
    const statuses: Record<string, { isLoggedIn: boolean; username?: string }> = {}

    for (const s of SUPPORTED_SITES) {
      statuses[s] = await checkLoginStatus(s)
    }

    return statuses
  } catch (error) {
    console.error('[auth/status] Error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to check login status'
    })
  }
})

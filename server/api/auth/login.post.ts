import { openLoginPage, type SupportedSite } from '../../scraper/utils/browser'

const SUPPORTED_SITES: SupportedSite[] = ['linkedin', 'naukri']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const site = body?.site as string | undefined

  if (!site) {
    throw createError({
      statusCode: 400,
      message: 'Site is required'
    })
  }

  if (!SUPPORTED_SITES.includes(site as SupportedSite)) {
    throw createError({
      statusCode: 400,
      message: `Invalid site: ${site}. Supported sites: ${SUPPORTED_SITES.join(', ')}`
    })
  }

  try {
    const result = await openLoginPage(site as SupportedSite)
    return result
  } catch (error) {
    console.error('[auth/login] Error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to open login page'
    })
  }
})

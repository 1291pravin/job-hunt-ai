import { z } from 'zod'
import { setSetting } from '../database'

const schema = z.object({
  keywords: z.array(z.string()).optional(),
  enabled_sources: z.array(z.string()).optional(),
  pages_to_scrape: z.number().min(1).max(10).optional(),
  scrape_mode: z.enum(['search', 'recommendations', 'both']).optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Validation failed', data: result.error.flatten() })
  }

  const settings = result.data

  if (settings.keywords !== undefined) {
    setSetting('keywords', JSON.stringify(settings.keywords))
  }

  if (settings.enabled_sources !== undefined) {
    setSetting('enabled_sources', JSON.stringify(settings.enabled_sources))
  }

  if (settings.pages_to_scrape !== undefined) {
    setSetting('pages_to_scrape', String(settings.pages_to_scrape))
  }

  if (settings.scrape_mode !== undefined) {
    setSetting('scrape_mode', settings.scrape_mode)
  }

  return { success: true }
})

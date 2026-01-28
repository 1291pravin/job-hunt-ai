import { getAllSettings } from '../database'

export default defineEventHandler(() => {
  const settings = getAllSettings()

  return {
    keywords: JSON.parse(settings.keywords || '[]'),
    enabled_sources: JSON.parse(settings.enabled_sources || '[]'),
    pages_to_scrape: parseInt(settings.pages_to_scrape || '3', 10),
    scrape_mode: settings.scrape_mode || 'search'
  }
})

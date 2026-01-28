import { getAllJobs, getJobStats } from '../database'

export default defineEventHandler((event) => {
  const query = getQuery(event)

  const filters = {
    status: query.status as string | undefined,
    source: query.source as string | undefined,
    search: query.search as string | undefined,
    page: query.page ? parseInt(query.page as string, 10) : 1,
    perPage: query.perPage ? parseInt(query.perPage as string, 10) : 20,
    sort: (query.sort as string) || 'date'
  }

  const { jobs, total } = getAllJobs(filters)
  const stats = getJobStats()

  return { jobs, total, page: filters.page, perPage: filters.perPage, stats }
})

import { getJobById, getApplicationsByJobId } from '../../database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '', 10)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid job ID' })
  }

  const job = getJobById(id)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Job not found' })
  }

  const applications = getApplicationsByJobId(id)
  return { job, applications }
})
